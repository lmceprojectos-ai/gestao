export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

type LinhaPagamento = { metodo: string; valor: number; contaBancariaId?: string | null };

// Marca VÁRIAS despesas como pagas de uma só vez. O pagamento pode ser
// DIVIDIDO por vários métodos, cada um com o seu valor (ex.: parte em
// dinheiro/caixa, parte por transferência do banco).
//
// Regras de saldo:
//  - Cada linha em "numerário" gera uma saída de Caixa com o valor indicado
//    (a Caixa é calculada a partir dos movimentos de caixa).
//  - Os saldos bancários são calculados a partir da data de referência de
//    cada conta (ver /api/contas/recalcular); este endpoint apenas regista a
//    conta/método em cada despesa para efeitos de registo.
//  - Se houver apenas UMA linha, o método/conta é aplicado a todas as despesas.
//    Com várias linhas (pagamento misto), as despesas ficam com método
//    "misto" e o detalhe da divisão é guardado nas notas.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const criadoPor = session?.user?.name || session?.user?.email || null;

    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Nenhuma despesa selecionada' }, { status: 400 });

    const linhasRaw: LinhaPagamento[] = Array.isArray(body.pagamentos) ? body.pagamentos : [];
    const linhas = linhasRaw
      .map((l) => ({ metodo: l.metodo, valor: Math.round((Number(l.valor) || 0) * 100) / 100, contaBancariaId: l.contaBancariaId || null }))
      .filter((l) => l.metodo && l.valor > 0);
    if (linhas.length === 0) return NextResponse.json({ error: 'Indique pelo menos um método de pagamento com valor' }, { status: 400 });

    const dataPagamento: Date = body.dataPagamento ? new Date(body.dataPagamento) : new Date();

    // Comprovativo(s) (o(s) mesmo(s) aplicado(s) a todas as despesas).
    // Aceita uma lista `comprovativos: [{path, contentType, nomeOriginal}]` (permite
    // vários comprovativos, ex.: um por cada método num pagamento misto) e ainda os
    // campos singulares antigos por retrocompatibilidade.
    type Comp = { path: string; contentType?: string | null; nomeOriginal?: string | null };
    const comprovativosRaw: Comp[] = Array.isArray(body.comprovativos) ? body.comprovativos : [];
    const comprovativos: Comp[] = comprovativosRaw
      .filter((c) => c && c.path)
      .map((c) => ({ path: c.path, contentType: c.contentType || null, nomeOriginal: c.nomeOriginal || null }));
    if (comprovativos.length === 0 && body.comprovativoPath) {
      comprovativos.push({ path: body.comprovativoPath, contentType: body.comprovativoContentType || null, nomeOriginal: body.comprovativoNomeOriginal || null });
    }
    const comprovativoPrincipal = comprovativos[0] || null;

    const despesas = await prisma.despesa.findMany({ where: { id: { in: ids } } });
    if (despesas.length === 0) return NextResponse.json({ error: 'Despesas não encontradas' }, { status: 404 });

    const totalDespesas = Math.round(despesas.reduce((acc, d) => acc + (d.valor || 0), 0) * 100) / 100;

    // Etiquetas dos métodos para as notas
    const METODO_LABEL: Record<string, string> = { numerario: 'Dinheiro (caixa)', transferencia: 'Transferência bancária', multibanco: 'Multibanco', mbway: 'MB WAY', debito_direto: 'Débito direto', cartao: 'Cartão', cheque: 'Cheque' };
    const contasInfo = await prisma.contaBancaria.findMany({ where: { id: { in: linhas.map((l) => l.contaBancariaId).filter(Boolean) as string[] } } });
    const contaNome = (id: string | null) => (id ? (contasInfo.find((c) => c.id === id)?.nome || '') : '');

    const misto = linhas.length > 1;
    const resumoDivisao = linhas
      .map((l) => `${METODO_LABEL[l.metodo] || l.metodo}${l.contaBancariaId ? ` (${contaNome(l.contaBancariaId)})` : ''}: ${l.valor.toFixed(2)}€`)
      .join(' + ');

    await prisma.$transaction(async (tx) => {
      // 1) Atualizar as despesas
      const updateData: any = { estado: 'pago' };
      if (misto) {
        updateData.metodoPagamento = 'misto';
        updateData.contaBancariaId = null;
      } else {
        updateData.metodoPagamento = linhas[0].metodo;
        updateData.contaBancariaId = linhas[0].metodo === 'numerario' ? null : (linhas[0].contaBancariaId || null);
      }
      if (comprovativoPrincipal) {
        updateData.comprovativoPath = comprovativoPrincipal.path;
        updateData.comprovativoContentType = comprovativoPrincipal.contentType;
        updateData.comprovativoNomeOriginal = comprovativoPrincipal.nomeOriginal;
        updateData.comprovativosExtra = comprovativos;
      }
      await tx.despesa.updateMany({ where: { id: { in: ids } }, data: updateData });

      // Guardar o detalhe da divisão nas notas de cada despesa (quando misto)
      if (misto) {
        for (const d of despesas) {
          const notaDivisao = `Pagamento dividido: ${resumoDivisao}`;
          const novasNotas = d.notas ? `${d.notas}\n${notaDivisao}` : notaDivisao;
          await tx.despesa.update({ where: { id: d.id }, data: { notas: novasNotas } });
        }
      }

      // 2) Criar saída(s) de Caixa para as linhas em numerário
      for (const l of linhas) {
        if (l.metodo === 'numerario') {
          await tx.caixaMovimento.create({
            data: {
              descricao: `Pagamento de ${despesas.length} despesa(s) em dinheiro`,
              valor: l.valor,
              data: dataPagamento,
              tipo: 'saida',
              categoria: 'compra',
              notas: misto ? `Parte em dinheiro do pagamento dividido (${resumoDivisao}).` : 'Saída de caixa ao marcar despesas como pagas em dinheiro.',
              criadoPor,
            },
          });
        }
      }
    });

    const totalLinhas = Math.round(linhas.reduce((a, l) => a + l.valor, 0) * 100) / 100;
    return NextResponse.json({ ok: true, count: despesas.length, totalDespesas, totalLinhas, misto, linhas: linhas.length });
  } catch (error: any) {
    console.error('Erro ao pagar despesas em lote:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao pagar despesas' }, { status: 500 });
  }
}
