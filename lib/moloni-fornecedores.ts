// Documentos de fornecedores no Moloni (módulo Compras): faturas, faturas
// simplificadas, recibos e notas de crédito/débito.
//
// As faturas de fornecedores são lançadas na app (digitalizações ou à mão), por
// isso a importação NÃO cria documentos: só liga ao Moloni os que já existem na
// app, para depois se poderem conciliar recibos e notas de crédito. Os que estão
// no Moloni e não na app são apenas contados.
//
// Como encontrar o par na app: o Moloni numera as compras com a série dele
// (ex.: K2026/187); o número da fatura do fornecedor vem em "your_reference".
//  1. mesmo fornecedor (NIF ou ficha) e referência = número na app;
//  2. senão, mesmo fornecedor, mesmo valor (±0,05 €) e data até 10 dias.
import { prisma } from '@/lib/db';
import { moloniRequest } from '@/lib/moloni';

export const DOC_TYPES_FORNECEDOR = [
  { endpoint: 'supplierInvoices', label: 'Faturas de fornecedor', tipo: 'recebida', grupo: 'faturas' },
  { endpoint: 'supplierSimplifiedInvoices', label: 'Faturas simplificadas de fornecedor', tipo: 'recebida', grupo: 'faturas' },
  { endpoint: 'supplierReceipts', label: 'Recibos de fornecedor', tipo: 'recibo', grupo: 'recibos' },
  { endpoint: 'supplierCreditNotes', label: 'Notas de crédito de fornecedor', tipo: 'nota_credito', grupo: 'notas' },
  { endpoint: 'supplierDebitNotes', label: 'Notas de débito de fornecedor', tipo: 'nota_debito', grupo: 'notas' },
] as const;

export type GrupoFornecedor = 'faturas' | 'recibos' | 'notas';

const ANO_MINIMO_IMPORTACAO = 2026;
const TIPOS_NOTA = ['nota', 'nota_credito', 'nota_debito'];
const soDigitos = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
const normalizarNumero = (s: string | null | undefined) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

type Candidato = { id: string; numero: string | null; valor: number | null; dataEmissao: Date | null; entidadeNif: string | null; fornecedorId: string | null };

// Procura na app o documento que corresponde a um documento de fornecedor do Moloni.
export function encontrarPar(
  doc: { referencia: string | null; valor: number; data: Date | null; nif: string; fornecedorId: string | null },
  candidatos: Candidato[],
  usados: Set<string>,
): Candidato | null {
  const mesmoFornecedor = candidatos.filter((c) => !usados.has(c.id) && (
    (doc.nif && soDigitos(c.entidadeNif) === doc.nif) || (doc.fornecedorId && c.fornecedorId === doc.fornecedorId)));
  const ref = normalizarNumero(doc.referencia);
  if (ref.length >= 3) {
    const porRef = mesmoFornecedor.find((c) => {
      const n = normalizarNumero(c.numero);
      return n.length >= 3 && (n === ref || n.endsWith(ref) || ref.endsWith(n));
    });
    if (porRef) return porRef;
  }
  const dias = (c: Candidato) => (doc.data && c.dataEmissao ? Math.abs(c.dataEmissao.getTime() - doc.data.getTime()) / 86400000 : 999);
  return mesmoFornecedor
    .filter((c) => Math.abs((c.valor ?? 0) - doc.valor) < 0.05 && dias(c) <= 10)
    .sort((a, b) => dias(a) - dias(b))[0] ?? null;
}

// Documentos da app que podem ser o par (ainda sem ligação ao Moloni).
async function candidatosNaApp(tipo: string) {
  return prisma.fatura.findMany({
    where: {
      moloniId: null,
      estado: { not: 'anulado' },
      tipo: TIPOS_NOTA.includes(tipo) ? { in: TIPOS_NOTA } : tipo,
      OR: [{ origem: 'fornecedor' }, { tipo: 'recebida' }],
    },
    select: { id: true, numero: true, valor: true, dataEmissao: true, entidadeNif: true, fornecedorId: true },
  });
}

export async function syncDocumentosFornecedor(companyId: number, grupo?: GrupoFornecedor) {
  const result = {
    imported: 0, updated: 0, linked: 0, skipped: 0, naoNaApp: 0,
    exemplosNaoNaApp: [] as string[],
    errors: [] as string[],
    byType: {} as Record<string, { updated: number; linked: number; naoNaApp: number }>,
  };

  const fornecedores = await prisma.fornecedor.findMany({ where: { nif: { not: null } }, select: { id: true, nif: true } });
  const porNif = new Map(fornecedores.map((f) => [soDigitos(f.nif), f.id]));

  for (const docType of DOC_TYPES_FORNECEDOR) {
    if (grupo && docType.grupo !== grupo) continue;
    const r = { updated: 0, linked: 0, naoNaApp: 0 };
    const candidatos = await candidatosNaApp(docType.tipo);
    const usados = new Set<string>();
    let offset = 0;
    try {
      while (true) {
        const docs = await moloniRequest(`${docType.endpoint}/getAll`, { company_id: companyId, qty: 50, offset });
        if (!Array.isArray(docs)) {
          // O Moloni devolve um objeto de erro (ex.: sem acesso ao módulo de compras).
          if (docs && (docs.error || docs.errors || docs.valid === 0)) {
            result.errors.push(`${docType.label}: ${JSON.stringify(docs.error_description || docs.errors || docs.error).slice(0, 150)}`);
          }
          break;
        }
        if (docs.length === 0) break;

        for (const doc of docs) {
          try {
            const data = doc.date ? new Date(doc.date) : null;
            if (data && data.getFullYear() < ANO_MINIMO_IMPORTACAO) { result.skipped++; continue; }
            const status = doc.status ?? 0;

            // Já ligado: só atualiza o estado no Moloni.
            const ligado = await prisma.fatura.findUnique({ where: { moloniId: doc.document_id }, select: { id: true } });
            if (ligado) {
              await prisma.fatura.update({ where: { id: ligado.id }, data: { moloniStatus: status, ...(status === 2 ? { estado: 'anulado' } : {}) } });
              r.updated++; result.updated++;
              continue;
            }
            if (status === 2) continue; // anulado no Moloni

            const nif = soDigitos(doc.entity_vat);
            const fornecedorId = (nif && porNif.get(nif)) || null;
            const valor = doc.net_value || doc.exchange_total_value || 0;
            const par = encontrarPar({ referencia: doc.your_reference || null, valor, data, nif, fornecedorId }, candidatos, usados);
            if (par) {
              usados.add(par.id);
              await prisma.fatura.update({
                where: { id: par.id },
                data: { moloniId: doc.document_id, moloniDocType: docType.endpoint, moloniStatus: status, ...(par.fornecedorId || !fornecedorId ? {} : { fornecedorId }) },
              });
              r.linked++; result.linked++;
            } else {
              r.naoNaApp++; result.naoNaApp++;
              if (result.exemplosNaoNaApp.length < 5) {
                result.exemplosNaoNaApp.push(`${doc.entity_name || 'Fornecedor'} ${doc.your_reference || ''} (${valor.toFixed(2)} €)`.replace(/\s+/g, ' '));
              }
            }
          } catch (e: any) {
            result.errors.push(`${docType.label} ${doc?.number}: ${e.message}`);
          }
        }
        offset += docs.length;
        if (docs.length < 50) break;
      }
    } catch (e: any) {
      result.errors.push(`${docType.label}: ${e.message}`);
    }
    result.byType[docType.label] = r;
  }
  return result;
}

// ---- Limpeza dos documentos de fornecedores criados pela importação antiga ----
// (versão que criava documentos: descrição "<label> <número>" e nomeOriginal "<label>_…").
// Cada um é apagado; se tiver par na app, a ligação ao Moloni passa para o par.
// Não se apaga nenhum que tenha pagamentos, recebimentos ou notas ligadas.
async function criadosPelaImportacao() {
  const labels = DOC_TYPES_FORNECEDOR.map((d) => d.label);
  const docs = await prisma.fatura.findMany({
    where: { moloniDocType: { startsWith: 'supplier' }, cloudStoragePath: '' },
    select: {
      id: true, tipo: true, numero: true, referencia: true, valor: true, dataEmissao: true, entidadeNif: true, fornecedorId: true,
      nomeOriginal: true, moloniId: true, moloniDocType: true, moloniStatus: true,
      _count: { select: { pagamentos: true, recebimentos: true, notasCredito: true } },
    },
  });
  return docs.filter((d) => labels.some((l) => d.nomeOriginal.startsWith(`${l}_`)));
}

export async function duplicadosFornecedorMoloni() {
  const docs = await criadosPelaImportacao();
  const bloqueados = docs.filter((d) => d._count.pagamentos + d._count.recebimentos + d._count.notasCredito > 0);
  const valor = docs.reduce((s, d) => s + (d.valor ?? 0), 0);
  return { total: docs.length, valor: Math.round(valor * 100) / 100, bloqueados: bloqueados.length };
}

export async function limparDuplicadosFornecedorMoloni() {
  const docs = await criadosPelaImportacao();
  const res = { apagados: 0, ligadosAoPar: 0, bloqueados: 0 };
  const candidatosPorTipo = new Map<string, Candidato[]>();
  const usados = new Set<string>();

  for (const d of docs) {
    if (d._count.pagamentos + d._count.recebimentos + d._count.notasCredito > 0) { res.bloqueados++; continue; }
    const chave = TIPOS_NOTA.includes(d.tipo) ? 'nota' : d.tipo;
    if (!candidatosPorTipo.has(chave)) candidatosPorTipo.set(chave, await candidatosNaApp(d.tipo));
    const par = encontrarPar(
      { referencia: d.referencia, valor: d.valor ?? 0, data: d.dataEmissao, nif: soDigitos(d.entidadeNif), fornecedorId: d.fornecedorId },
      candidatosPorTipo.get(chave)!,
      usados,
    );
    await prisma.$transaction(async (tx) => {
      await tx.fatura.delete({ where: { id: d.id } });
      if (par) {
        await tx.fatura.update({
          where: { id: par.id },
          data: { moloniId: d.moloniId, moloniDocType: d.moloniDocType, moloniStatus: d.moloniStatus, ...(par.fornecedorId || !d.fornecedorId ? {} : { fornecedorId: d.fornecedorId }) },
        });
      }
    });
    if (par) { usados.add(par.id); res.ligadosAoPar++; }
    res.apagados++;
  }
  return res;
}
