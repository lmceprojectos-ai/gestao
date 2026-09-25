export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getMoloniCompanyId,
  getMoloniCustomers,
  getMoloniSuppliers,
  getMoloniDocuments,
  DOC_TYPES,
} from '@/lib/moloni';
import { syncDocumentosFornecedor, type GrupoFornecedor } from '@/lib/moloni-fornecedores';
import { conciliarDocumentosMoloni } from '@/lib/moloni-conciliar';

function moloniStatusLabel(status: number): string {
  switch (status) {
    case 0: return 'rascunho';
    case 1: return 'fechado';
    case 2: return 'anulado';
    default: return 'rascunho';
  }
}

async function syncCustomers(companyId: number) {
  const result = { imported: 0, updated: 0, errors: [] as string[] };
  try {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const customers = await getMoloniCustomers(companyId, offset);
      if (!Array.isArray(customers) || customers.length === 0) {
        hasMore = false;
        break;
      }
      for (const c of customers) {
        try {
          const data = {
            nome: c.name || 'Sem nome',
            nif: c.vat && c.vat !== '999999990' && c.vat !== '' ? c.vat : null,
            email: c.email || null,
            telefone: c.phone || null,
            morada: c.address || null,
            cidade: c.city || null,
            codigoPostal: c.zip_code || null,
            website: c.website || null,
            contactoNome: c.contact_name || null,
            contactoEmail: c.contact_email || null,
            contactoTel: c.contact_phone || null,
            notas: c.notes || null,
          };

          const existing = await prisma.cliente.findUnique({ where: { moloniId: c.customer_id } });
          if (existing) {
            await prisma.cliente.update({ where: { moloniId: c.customer_id }, data });
            result.updated++;
          } else {
            // Check by NIF
            let existingByNif = null;
            if (data.nif) {
              existingByNif = await prisma.cliente.findUnique({ where: { nif: data.nif } });
            }
            if (existingByNif) {
              await prisma.cliente.update({
                where: { id: existingByNif.id },
                data: { ...data, moloniId: c.customer_id },
              });
              result.updated++;
            } else {
              await prisma.cliente.create({
                data: { ...data, moloniId: c.customer_id },
              });
              result.imported++;
            }
          }
        } catch (e: any) {
          result.errors.push(`Cliente ${c.name}: ${e.message}`);
        }
      }
      offset += customers.length;
      if (customers.length < 50) hasMore = false;
    }
  } catch (e: any) {
    result.errors.push(`Erro geral: ${e.message}`);
  }
  return result;
}

async function syncSuppliers(companyId: number) {
  const result = { imported: 0, updated: 0, errors: [] as string[] };
  try {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const suppliers = await getMoloniSuppliers(companyId, offset);
      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        hasMore = false;
        break;
      }
      for (const s of suppliers) {
        try {
          const data = {
            nome: s.name || 'Sem nome',
            nif: s.vat && s.vat !== '999999990' && s.vat !== '' ? s.vat : null,
            email: s.email || null,
            telefone: s.phone || null,
            morada: s.address || null,
            cidade: s.city || null,
            codigoPostal: s.zip_code || null,
            website: s.website || null,
            contactoNome: s.contact_name || null,
            contactoEmail: s.contact_email || null,
            contactoTel: s.contact_phone || null,
            notas: s.notes || null,
          };

          const existing = await prisma.fornecedor.findUnique({ where: { moloniId: s.supplier_id } });
          if (existing) {
            await prisma.fornecedor.update({ where: { moloniId: s.supplier_id }, data });
            result.updated++;
          } else {
            let existingByNif = null;
            if (data.nif) {
              existingByNif = await prisma.fornecedor.findUnique({ where: { nif: data.nif } });
            }
            if (existingByNif) {
              await prisma.fornecedor.update({
                where: { id: existingByNif.id },
                data: { ...data, moloniId: s.supplier_id },
              });
              result.updated++;
            } else {
              await prisma.fornecedor.create({
                data: { ...data, moloniId: s.supplier_id },
              });
              result.imported++;
            }
          }
        } catch (e: any) {
          result.errors.push(`Fornecedor ${s.name}: ${e.message}`);
        }
      }
      offset += suppliers.length;
      if (suppliers.length < 50) hasMore = false;
    }
  } catch (e: any) {
    result.errors.push(`Erro geral: ${e.message}`);
  }
  return result;
}

// Apenas importamos documentos com data de emissão a partir de 2026
const ANO_MINIMO_IMPORTACAO = 2026;

// Grupos de documentos usados pelos botões de cada página.
const GRUPOS_DOCUMENTOS: Record<string, string[]> = {
  faturas: ['invoices', 'invoiceReceipts', 'simplifiedInvoices'],
  recibos: ['receipts'],
  notas: ['creditNotes', 'debitNotes'],
};

async function syncDocuments(companyId: number, grupo?: string) {
  const result = { imported: 0, updated: 0, skipped: 0, errors: [] as string[], byType: {} as Record<string, { imported: number; updated: number }> };
  try {
    const endpoints = grupo ? GRUPOS_DOCUMENTOS[grupo] : null;
    for (const docType of DOC_TYPES) {
      if (endpoints && !endpoints.includes(docType.endpoint)) continue;
      const typeResult = { imported: 0, updated: 0 };
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const docs = await getMoloniDocuments(companyId, docType.endpoint, offset);
        if (!Array.isArray(docs) || docs.length === 0) {
          hasMore = false;
          break;
        }
        for (const doc of docs) {
          try {
            // Ignorar documentos anteriores a 2026
            const anoDoc = doc.date ? new Date(doc.date).getFullYear() : null;
            if (anoDoc !== null && anoDoc < ANO_MINIMO_IMPORTACAO) {
              result.skipped++;
              continue;
            }

            const docId = doc.document_id;

            // Find associated client or supplier
            let clienteId: string | null = null;
            let fornecedorId: string | null = null;
            if (doc.customer_id) {
              const cliente = await prisma.cliente.findUnique({ where: { moloniId: doc.customer_id } });
              if (cliente) clienteId = cliente.id;
            }
            if (doc.supplier_id) {
              const fornecedor = await prisma.fornecedor.findUnique({ where: { moloniId: doc.supplier_id } });
              if (fornecedor) fornecedorId = fornecedor.id;
            }

            const numStr = doc.number && doc.number > 0 ? String(doc.number) : '';
            const serieNum = doc.document_set_name
              ? `${doc.document_set_name}/${numStr}`
              : numStr;

            const faturaData = {
              numero: serieNum,
              descricao: `${docType.label} ${serieNum}`.trim(),
              tipo: docType.endpoint === 'creditNotes'
                ? 'nota_credito' : docType.endpoint === 'debitNotes'
                ? 'nota_debito' : docType.endpoint === 'estimates'
                ? 'orcamento' : docType.endpoint === 'receipts'
                ? 'recibo' : docType.endpoint.includes('delivery') || docType.endpoint.includes('bill') || docType.endpoint.includes('waybill')
                ? 'guia' : 'emitida',
              origem: 'cliente',
              valor: doc.net_value || doc.exchange_total_value || 0,
              valorBruto: doc.gross_value || null,
              valorReconciliado: doc.reconciled_value != null ? doc.reconciled_value : null,
              impostos: doc.taxes_value || null,
              estado: moloniStatusLabel(doc.status ?? 0),
              dataEmissao: doc.date ? new Date(doc.date) : null,
              dataVencimento: doc.expiration_date ? new Date(doc.expiration_date) : null,
              serieName: doc.document_set_name || null,
              entidadeNome: doc.entity_name || null,
              entidadeNif: doc.entity_vat || null,
              referencia: doc.your_reference || doc.our_reference || null,
              clienteId,
              fornecedorId,
              moloniDocType: docType.endpoint,
              moloniStatus: doc.status ?? 0,
            };

            const existing = await prisma.fatura.findUnique({ where: { moloniId: docId } });
            if (existing) {
              await prisma.fatura.update({ where: { moloniId: docId }, data: faturaData });
              typeResult.updated++;
              result.updated++;
            } else {
              await prisma.fatura.create({
                data: {
                  ...faturaData,
                  moloniId: docId,
                  cloudStoragePath: '',
                  nomeOriginal: `${docType.label}_${numStr || docId}`,
                },
              });
              typeResult.imported++;
              result.imported++;
            }
          } catch (e: any) {
            result.errors.push(`${docType.label} ${doc.number}: ${e.message}`);
          }
        }
        offset += docs.length;
        if (docs.length < 50) hasMore = false;
      }
      result.byType[docType.label] = typeResult;
    }
  } catch (e: any) {
    result.errors.push(`Erro geral: ${e.message}`);
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    // type: 'clientes', 'fornecedores', 'faturas', 'documentosFornecedor', 'all'
    // grupo (opcional, com 'faturas'): 'faturas' | 'recibos' | 'notas'
    // incluirClientes: atualiza os clientes antes, para ligar os documentos novos
    // incluirFornecedores: idem para os documentos de fornecedores
    const { type, grupo, incluirClientes, incluirFornecedores } = body;
    if (grupo && !GRUPOS_DOCUMENTOS[grupo]) {
      return NextResponse.json({ error: 'Grupo de documentos inválido' }, { status: 400 });
    }

    const companyId = await getMoloniCompanyId();
    const results: Record<string, any> = {};

    if (type === 'clientes' || type === 'all' || (type === 'faturas' && incluirClientes)) {
      results.clientes = await syncCustomers(companyId);
    }

    if (type === 'fornecedores' || type === 'all' || (type === 'documentosFornecedor' && incluirFornecedores)) {
      results.fornecedores = await syncSuppliers(companyId);
    }

    if (type === 'faturas' || type === 'all') {
      results.faturas = await syncDocuments(companyId, grupo);
      // Recibos e notas de crédito ficam logo ligados às faturas que liquidam.
      if (grupo === 'recibos' || grupo === 'notas') {
        results.conciliacao = await conciliarDocumentosMoloni(companyId, 'cliente', grupo);
      }
    }

    if (type === 'documentosFornecedor') {
      results.documentosFornecedor = await syncDocumentosFornecedor(companyId, grupo as GrupoFornecedor | undefined);
      if (grupo === 'recibos' || grupo === 'notas') {
        results.conciliacao = await conciliarDocumentosMoloni(companyId, 'fornecedor', grupo);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Moloni sync error:', error);
    return NextResponse.json({ error: error.message || 'Erro na sincronização' }, { status: 500 });
  }
}
