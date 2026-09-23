export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { contaBancariaId } = body ?? {};

    // Get unreconciled movements
    const where: any = { reconciliado: false };
    if (contaBancariaId) where.contaBancariaId = contaBancariaId;

    const movimentos = await prisma.movimentoBancario.findMany({
      where,
      orderBy: { dataMovimento: 'asc' },
    });

    // Get unreconciled pagamentos and recebimentos
    const pagamentos = await prisma.pagamento.findMany({
      where: { reconciliado: false, estado: 'pago' },
      include: { fornecedor: { select: { nome: true } } },
    });

    const recebimentos = await prisma.recebimento.findMany({
      where: { reconciliado: false, estado: 'recebido' },
      include: { cliente: { select: { nome: true } } },
    });

    // Fetch unpaid faturas de fornecedor for debit matching
    const faturas = await prisma.fatura.findMany({
      where: { tipo: 'recebida', estado: { not: 'anulado' } },
      include: {
        fornecedor: { select: { nome: true } },
        pagamentos: { select: { id: true, valor: true, estado: true } },
      },
    });
    const faturasPendentes = faturas.map((f) => {
      const totalPago = f.pagamentos.filter((p) => p.estado === 'pago').reduce((sum, p) => sum + p.valor, 0);
      const saldoPendente = (f.valor || 0) - totalPago;
      return { ...f, saldoPendente };
    }).filter((f) => f.saldoPendente > 0);

    const matches: Array<{ movimentoId: string; recebimentoId?: string; pagamentoId?: string; faturaId?: string; faturaClienteId?: string; confidence: string }> = [];
    const usedMovimentos = new Set<string>();
    const usedPagamentos = new Set<string>();
    const usedRecebimentos = new Set<string>();
    const usedFaturas = new Set<string>();

    // Match debits with pagamentos first
    for (const mov of movimentos) {
      if (usedMovimentos.has(mov.id)) continue;
      if (mov.tipo !== 'debito') continue;

      for (const pag of pagamentos) {
        if (usedPagamentos.has(pag.id)) continue;

        const valorMatch = Math.abs(mov.valor - pag.valor) < 0.01;
        if (!valorMatch) continue;

        const movDate = new Date(mov.dataMovimento).getTime();
        const pagDate = new Date(pag.dataPagamento).getTime();
        const daysDiff = Math.abs(movDate - pagDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 5) {
          const confidence = daysDiff <= 1 ? 'alta' : daysDiff <= 3 ? 'media' : 'baixa';
          matches.push({ movimentoId: mov.id, pagamentoId: pag.id, confidence });
          usedMovimentos.add(mov.id);
          usedPagamentos.add(pag.id);
          break;
        }
      }
    }

    // Match unmatched debits with unpaid faturas de fornecedor
    for (const mov of movimentos) {
      if (usedMovimentos.has(mov.id)) continue;
      if (mov.tipo !== 'debito') continue;

      for (const fat of faturasPendentes) {
        if (usedFaturas.has(fat.id)) continue;

        const valorMatch = Math.abs(mov.valor - fat.saldoPendente) < 0.01;
        if (!valorMatch) continue;

        // For faturas, we use a wider date window (30 days)
        if (fat.dataEmissao) {
          const movDate = new Date(mov.dataMovimento).getTime();
          const fatDate = new Date(fat.dataEmissao).getTime();
          const daysDiff = Math.abs(movDate - fatDate) / (1000 * 60 * 60 * 24);
          if (daysDiff > 60) continue; // too far apart
        }

        matches.push({ movimentoId: mov.id, faturaId: fat.id, confidence: 'media' });
        usedMovimentos.add(mov.id);
        usedFaturas.add(fat.id);
        break;
      }
    }

    // Match credits with recebimentos
    for (const mov of movimentos) {
      if (usedMovimentos.has(mov.id)) continue;
      if (mov.tipo !== 'credito') continue;

      for (const rec of recebimentos) {
        if (usedRecebimentos.has(rec.id)) continue;

        const valorMatch = Math.abs(mov.valor - rec.valor) < 0.01;
        if (!valorMatch) continue;

        const movDate = new Date(mov.dataMovimento).getTime();
        const recDate = new Date(rec.dataRecebimento).getTime();
        const daysDiff = Math.abs(movDate - recDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 5) {
          const confidence = daysDiff <= 1 ? 'alta' : daysDiff <= 3 ? 'media' : 'baixa';
          matches.push({ movimentoId: mov.id, recebimentoId: rec.id, confidence });
          usedMovimentos.add(mov.id);
          usedRecebimentos.add(rec.id);
          break;
        }
      }
    }

    // Fetch unpaid faturas de clientes (emitidas) for credit matching
    const faturasCliente = await prisma.fatura.findMany({
      where: { tipo: 'emitida', estado: { not: 'anulado' } },
      include: {
        cliente: { select: { nome: true } },
        recebimentos: { select: { id: true, valor: true, estado: true } },
      },
    });
    const faturasClientePendentes = faturasCliente.map((f) => {
      const totalRecebido = f.recebimentos.filter((r) => r.estado === 'recebido').reduce((sum, r) => sum + r.valor, 0);
      const saldoPendente = (f.valor || 0) - totalRecebido;
      return { ...f, saldoPendente };
    }).filter((f) => f.saldoPendente > 0);

    // Match unmatched credits with client invoices
    for (const mov of movimentos) {
      if (usedMovimentos.has(mov.id)) continue;
      if (mov.tipo !== 'credito') continue;

      for (const fat of faturasClientePendentes) {
        if (usedFaturas.has(fat.id)) continue;

        const valorMatch = Math.abs(mov.valor - fat.saldoPendente) < 0.01;
        if (!valorMatch) continue;

        if (fat.dataEmissao) {
          const movDate = new Date(mov.dataMovimento).getTime();
          const fatDate = new Date(fat.dataEmissao).getTime();
          const daysDiff = Math.abs(movDate - fatDate) / (1000 * 60 * 60 * 24);
          if (daysDiff > 60) continue;
        }

        matches.push({ movimentoId: mov.id, faturaId: fat.id, faturaClienteId: fat.id, confidence: 'media' });
        usedMovimentos.add(mov.id);
        usedFaturas.add(fat.id);
        break;
      }
    }

    return NextResponse.json({
      success: true,
      matches,
      summary: {
        totalMovimentos: movimentos.length,
        totalMatches: matches.length,
        alta: matches.filter(m => m.confidence === 'alta').length,
        media: matches.filter(m => m.confidence === 'media').length,
        baixa: matches.filter(m => m.confidence === 'baixa').length,
      }
    });
  } catch (error: any) {
    console.error('Auto reconciliation error:', error);
    return NextResponse.json({ error: error.message || 'Erro na reconciliação automática' }, { status: 500 });
  }
}

// Apply matches
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { matches } = body ?? {};

    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: 'Sem correspondências para aplicar' }, { status: 400 });
    }

    let applied = 0;

    for (const match of matches) {
      try {
        if (match.faturaClienteId) {
          // Client invoice match: create recebimento + reconcile
          const movimento = await prisma.movimentoBancario.findUnique({ where: { id: match.movimentoId } });
          const fatura = await prisma.fatura.findUnique({ where: { id: match.faturaClienteId }, include: { cliente: true } });
          if (movimento && fatura && !movimento.reconciliado) {
            const recebimento = await prisma.recebimento.create({
              data: {
                descricao: `Recebimento fatura ${fatura.numero || fatura.id.slice(0, 8)} - ${fatura.cliente?.nome || fatura.entidadeNome || 'Cliente'}`,
                valor: movimento.valor,
                dataRecebimento: movimento.dataMovimento,
                metodoPagamento: 'transferencia',
                estado: 'recebido',
                reconciliado: true,
                faturaId: fatura.id,
                clienteId: fatura.clienteId || undefined,
                contaBancariaId: movimento.contaBancariaId,
              },
            });
            await prisma.movimentoBancario.update({
              where: { id: match.movimentoId },
              data: { reconciliado: true, recebimentoId: recebimento.id },
            });
            applied++;
          }
        } else if (match.faturaId) {
          // Supplier fatura match: create pagamento + reconcile
          const movimento = await prisma.movimentoBancario.findUnique({ where: { id: match.movimentoId } });
          const fatura = await prisma.fatura.findUnique({ where: { id: match.faturaId } });
          if (movimento && fatura && !movimento.reconciliado) {
            const pagamento = await prisma.pagamento.create({
              data: {
                descricao: `Pagamento fatura ${fatura.numero || fatura.id.slice(0, 8)}`,
                valor: movimento.valor,
                dataPagamento: movimento.dataMovimento,
                metodoPagamento: 'transferencia',
                estado: 'pago',
                reconciliado: true,
                faturaId: fatura.id,
                fornecedorId: fatura.fornecedorId || undefined,
                contaBancariaId: movimento.contaBancariaId,
              },
            });
            await prisma.movimentoBancario.update({
              where: { id: match.movimentoId },
              data: { reconciliado: true, pagamentoId: pagamento.id },
            });
            applied++;
          }
        } else {
          await prisma.movimentoBancario.update({
            where: { id: match.movimentoId },
            data: {
              reconciliado: true,
              recebimentoId: match.recebimentoId || null,
              pagamentoId: match.pagamentoId || null,
            },
          });

          if (match.recebimentoId) {
            await prisma.recebimento.update({
              where: { id: match.recebimentoId },
              data: { reconciliado: true },
            });
          }
          if (match.pagamentoId) {
            await prisma.pagamento.update({
              where: { id: match.pagamentoId },
              data: { reconciliado: true },
            });
          }
          applied++;
        }
      } catch (err) {
        console.error('Error applying match:', err);
      }
    }

    return NextResponse.json({ success: true, applied });
  } catch (error: any) {
    console.error('Apply reconciliation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
