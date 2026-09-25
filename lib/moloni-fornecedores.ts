// Importa do Moloni os documentos de fornecedores (módulo Compras):
// faturas, faturas simplificadas, recibos e notas de crédito/débito.
// Estes documentos não trazem o supplier_id; o fornecedor é ligado pelo NIF.
// Um documento que já exista na app (digitalizado ou lançado à mão) com o
// mesmo NIF, o mesmo número e o mesmo valor é apenas marcado com o ID do
// Moloni, para não criar repetidos.
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
const soDigitos = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
const estadoMoloni = (status: number) => (status === 1 ? 'fechado' : status === 2 ? 'anulado' : 'rascunho');
// Último grupo de dígitos do número ("FT 26/8391" → "8391").
const ultimoNumero = (s: string | null | undefined) => (s || '').match(/\d+/g)?.pop()?.replace(/^0+/, '') ?? '';

export async function syncDocumentosFornecedor(companyId: number, grupo?: GrupoFornecedor) {
  const result = {
    imported: 0, updated: 0, linked: 0, skipped: 0,
    errors: [] as string[],
    byType: {} as Record<string, { imported: number; updated: number; linked: number }>,
  };

  const fornecedores = await prisma.fornecedor.findMany({ where: { nif: { not: null } }, select: { id: true, nif: true } });
  const porNif = new Map(fornecedores.map((f) => [soDigitos(f.nif), f.id]));

  for (const docType of DOC_TYPES_FORNECEDOR) {
    if (grupo && docType.grupo !== grupo) continue;
    const r = { imported: 0, updated: 0, linked: 0 };
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

            const numStr = doc.number && doc.number > 0 ? String(doc.number) : '';
            const serie = doc.document_set?.name || null;
            const numero = serie ? `${serie}/${numStr}` : numStr;
            const nif = soDigitos(doc.entity_vat);
            const fornecedorId = (nif && porNif.get(nif)) || null;
            const valor = doc.net_value || doc.exchange_total_value || 0;

            const dados = {
              numero,
              descricao: `${docType.label} ${numero}`.trim(),
              tipo: docType.tipo,
              origem: 'fornecedor',
              valor,
              valorBruto: doc.gross_value ?? null,
              impostos: doc.taxes_value ?? null,
              estado: estadoMoloni(doc.status ?? 0),
              dataEmissao: data,
              dataVencimento: doc.expiration_date ? new Date(doc.expiration_date) : null,
              serieName: serie,
              entidadeNome: doc.entity_name || null,
              entidadeNif: doc.entity_vat || null,
              referencia: doc.your_reference || doc.our_reference || null,
              fornecedorId,
              moloniDocType: docType.endpoint,
              moloniStatus: doc.status ?? 0,
            };

            const existente = await prisma.fatura.findUnique({ where: { moloniId: doc.document_id } });
            if (existente) {
              await prisma.fatura.update({ where: { id: existente.id }, data: dados });
              r.updated++; result.updated++;
              continue;
            }

            // Já está na app sem ligação ao Moloni? (mesmo NIF, mesmo número, mesmo valor)
            const candidatos = nif ? await prisma.fatura.findMany({
              where: {
                moloniId: null,
                origem: 'fornecedor',
                tipo: docType.tipo === 'nota_credito' || docType.tipo === 'nota_debito' ? { in: ['nota', 'nota_credito', 'nota_debito'] } : docType.tipo,
                OR: [{ entidadeNif: { contains: nif } }, ...(fornecedorId ? [{ fornecedorId }] : [])],
              },
              select: { id: true, numero: true, valor: true },
            }) : [];
            const igual = candidatos.find((c) =>
              ultimoNumero(c.numero) === numStr.replace(/^0+/, '') && Math.abs((c.valor ?? 0) - valor) < 0.05);
            if (igual) {
              await prisma.fatura.update({
                where: { id: igual.id },
                data: { moloniId: doc.document_id, moloniDocType: docType.endpoint, moloniStatus: doc.status ?? 0, fornecedorId: fornecedorId ?? undefined },
              });
              r.linked++; result.linked++;
              continue;
            }

            await prisma.fatura.create({
              data: { ...dados, moloniId: doc.document_id, cloudStoragePath: '', nomeOriginal: `${docType.label}_${numStr || doc.document_id}` },
            });
            r.imported++; result.imported++;
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
