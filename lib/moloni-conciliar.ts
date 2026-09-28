// Conciliação automática dos recibos e notas de crédito/débito importados do
// Moloni com as faturas a que pertencem. O Moloni indica em cada documento as
// faturas associadas (associated_documents: associated_id + value).
//
//  - Clientes: o valor já liquidado de cada fatura é relido do Moloni
//    (reconciled_value), que já conta com os recibos e as notas de crédito.
//  - Fornecedores: o Moloni não guarda esse valor nas compras; soma-se aqui o
//    valor de cada recibo/nota à fatura (cada documento só é processado uma vez).
//  - Fornecedores: um recibo que cobre o que falta valida o pagamento da fatura.
//  - Nota de crédito/débito: fica ligada à fatura (faturaRelacionadaId).
//
// Cada recibo/nota fica ligado à (primeira) fatura que liquida (faturaRelacionadaId)
// e marcado em validadoPor: "Moloni: conciliado" ou "Moloni: sem fatura na app"
// (fatura de um ano anterior, que não é importada, ou ainda não importada).
// Os já marcados não voltam a ser processados, para não serem somados duas vezes;
// os "sem fatura na app" dos últimos 60 dias voltam a ser tentados depois de
// importar faturas (reabrirSemFatura).
import { prisma } from '@/lib/db';
import { moloniRequest } from '@/lib/moloni';

const TIPOS_NOTA = ['nota', 'nota_credito', 'nota_debito'];
// Pedidos ao Moloni por clique (um por documento), para não esgotar o tempo do pedido.
const MAX_POR_EXECUCAO = 80;

export const MARCA_CONCILIADO = 'Moloni: conciliado';
export const MARCA_SEM_FATURA = 'Moloni: sem fatura na app';

// Depois de importar faturas: volta a tentar os recibos/notas recentes que ainda
// não tinham a fatura na app.
export async function reabrirSemFatura(origem: 'cliente' | 'fornecedor') {
  const desde = new Date(Date.now() - 60 * 86400000);
  await prisma.fatura.updateMany({
    where: { origem, validadoPor: MARCA_SEM_FATURA, dataEmissao: { gte: desde } },
    data: { validadoPor: null },
  });
}

export type ResultadoConciliacao = {
  conciliados: number;
  faturasLiquidadas: number;
  semFatura: number;
  porProcessar: number;
  erros: string[];
};

export async function conciliarDocumentosMoloni(
  companyId: number,
  origem: 'cliente' | 'fornecedor',
  grupo?: 'recibos' | 'notas' | 'faturas',
): Promise<ResultadoConciliacao> {
  const r: ResultadoConciliacao = { conciliados: 0, faturasLiquidadas: 0, semFatura: 0, porProcessar: 0, erros: [] };
  if (grupo === 'faturas') return r;

  const tipos = grupo === 'recibos' ? ['recibo'] : grupo === 'notas' ? TIPOS_NOTA : ['recibo', ...TIPOS_NOTA];
  const pendentes = await prisma.fatura.findMany({
    where: {
      origem,
      tipo: { in: tipos },
      moloniId: { not: null },
      moloniDocType: { not: null },
      OR: [{ validadoPor: null }, { NOT: { validadoPor: { startsWith: 'Moloni:' } } }],
      estado: { not: 'anulado' },
    },
    select: { id: true, tipo: true, numero: true, moloniId: true, moloniDocType: true, dataEmissao: true },
    orderBy: { dataEmissao: 'asc' },
  });
  r.porProcessar = Math.max(0, pendentes.length - MAX_POR_EXECUCAO);

  // Faturas de clientes cujo valor liquidado tem de ser relido do Moloni.
  const faturasARever = new Map<string, { moloniId: number; moloniDocType: string }>();

  for (const doc of pendentes.slice(0, MAX_POR_EXECUCAO)) {
    try {
      const completo = await moloniRequest(`${doc.moloniDocType}/getOne`, { company_id: companyId, document_id: doc.moloniId });
      const associados: { associated_id: number; value: number }[] = Array.isArray(completo?.associated_documents) ? completo.associated_documents : [];
      const faturas = associados.length
        ? await prisma.fatura.findMany({
            where: { moloniId: { in: associados.map((a) => a.associated_id) } },
            select: { id: true, tipo: true, valor: true, valorReconciliado: true, pagamentoValidado: true, moloniId: true, moloniDocType: true },
          })
        : [];
      if (faturas.length === 0) r.semFatura++;

      await prisma.$transaction(async (tx) => {
        for (const f of faturas) {
          const valorAssociado = associados.find((a) => a.associated_id === f.moloniId)?.value ?? 0;
          if (origem === 'fornecedor') {
            const total = f.valor ?? 0;
            const reconciliado = Math.min(total, Math.round(((f.valorReconciliado ?? 0) + valorAssociado) * 100) / 100);
            const liquidada = reconciliado >= total - 0.01;
            await tx.fatura.update({
              where: { id: f.id },
              data: {
                valorReconciliado: reconciliado,
                ...(doc.tipo === 'recibo' && liquidada && !f.pagamentoValidado
                  ? { pagamentoValidado: true, dataPagamento: doc.dataEmissao, dataValidacaoPagamento: new Date(), validadoPor: `Moloni: recibo ${doc.numero || ''}`.trim() }
                  : {}),
              },
            });
            if (liquidada) r.faturasLiquidadas++;
          } else if (f.moloniDocType) {
            faturasARever.set(f.id, { moloniId: f.moloniId!, moloniDocType: f.moloniDocType });
          }
        }
        await tx.fatura.update({
          where: { id: doc.id },
          data: {
            validadoPor: faturas.length ? MARCA_CONCILIADO : MARCA_SEM_FATURA,
            faturaRelacionadaId: faturas[0]?.id ?? null,
          },
        });
      });
      if (faturas.length) r.conciliados++;
    } catch (e: any) {
      r.erros.push(`${doc.numero || doc.moloniId}: ${e.message}`);
    }
  }

  // Clientes: reler do Moloni quanto de cada fatura já está liquidado.
  for (const [id, f] of faturasARever) {
    try {
      const inv = await moloniRequest(`${f.moloniDocType}/getOne`, { company_id: companyId, document_id: f.moloniId });
      if (typeof inv?.reconciled_value !== 'number') continue;
      const atual = await prisma.fatura.findUnique({ where: { id }, select: { valor: true } });
      const liquidada = atual?.valor != null && inv.reconciled_value >= atual.valor - 0.01;
      // Só o valor liquidado: o dashboard já não conta como "por receber" a
      // fatura liquidada, e uma nota de crédito não é um pagamento.
      await prisma.fatura.update({ where: { id }, data: { valorReconciliado: inv.reconciled_value } });
      if (liquidada) r.faturasLiquidadas++;
    } catch (e: any) {
      r.erros.push(`Fatura ${f.moloniId}: ${e.message}`);
    }
  }
  return r;
}
