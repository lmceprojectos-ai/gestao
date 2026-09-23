export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Desfaz (anula) uma reconciliacao de um movimento bancario.
//
// Dois cenarios:
//  1) Movimento reconciliado a um recebimento/pagamento JA EXISTENTE (fluxo
//     "por movimento"): apenas se desliga o movimento e o recebimento/pagamento
//     volta a ficar "nao reconciliado" (nada e apagado).
//  2) Movimento reconciliado a uma FATURA (fluxo "por fatura"): nesse fluxo foi
//     CRIADO automaticamente um pagamento/recebimento (descricao gerada pelo
//     sistema "Pagamento fatura ..." / "Recebimento fatura ..." e ligado a uma
//     fatura). Nesse caso o registo auto-criado e APAGADO, o saldo da conta e
//     revertido e a validacao de pagamento da fatura e anulada.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { movimentoId } = body ?? {};
    if (!movimentoId) return NextResponse.json({ error: 'Movimento é obrigatório' }, { status: 400 });

    const mov = await prisma.movimentoBancario.findUnique({
      where: { id: movimentoId },
      include: { recebimento: true, pagamento: true },
    });
    if (!mov) return NextResponse.json({ error: 'Movimento não encontrado' }, { status: 404 });
    if (!mov.reconciliado) return NextResponse.json({ error: 'O movimento não está reconciliado' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // 1. Desligar o movimento
      await tx.movimentoBancario.update({
        where: { id: movimentoId },
        data: { reconciliado: false, recebimentoId: null, pagamentoId: null },
      });

      // 2. Tratar o pagamento associado
      if (mov.pagamentoId && mov.pagamento) {
        const pag = mov.pagamento;
        const autoCriado = !!pag.faturaId && /^Pagamento fatura /.test(pag.descricao || '');
        if (autoCriado) {
          // reverter saldo (pagamento 'pago' tinha decrementado o saldo)
          if (pag.estado === 'pago' && pag.contaBancariaId) {
            await tx.contaBancaria.update({
              where: { id: pag.contaBancariaId },
              data: { saldoAtual: { increment: pag.valor } },
            });
          }
          // anular validacao de pagamento na fatura (se aplicavel)
          if (pag.faturaId) {
            await tx.fatura.update({
              where: { id: pag.faturaId },
              data: { pagamentoValidado: false, dataValidacaoPagamento: null, validadoPor: null },
            }).catch(() => {});
          }
          await tx.pagamento.delete({ where: { id: pag.id } });
        } else {
          await tx.pagamento.update({ where: { id: pag.id }, data: { reconciliado: false } });
        }
      }

      // 3. Tratar o recebimento associado
      if (mov.recebimentoId && mov.recebimento) {
        const rec = mov.recebimento;
        const autoCriado = !!rec.faturaId && /^Recebimento fatura /.test(rec.descricao || '');
        if (autoCriado) {
          // reverter saldo (recebimento 'pago'/'recebido' tinha incrementado o saldo)
          if ((rec.estado === 'pago' || rec.estado === 'recebido') && rec.contaBancariaId) {
            await tx.contaBancaria.update({
              where: { id: rec.contaBancariaId },
              data: { saldoAtual: { decrement: rec.valor } },
            });
          }
          // anular validacao de pagamento na fatura de cliente
          if (rec.faturaId) {
            await tx.fatura.update({
              where: { id: rec.faturaId },
              data: { pagamentoValidado: false, dataValidacaoPagamento: null, validadoPor: null },
            }).catch(() => {});
          }
          await tx.recebimento.delete({ where: { id: rec.id } });
        } else {
          await tx.recebimento.update({ where: { id: rec.id }, data: { reconciliado: false } });
        }
      }
    });

    return NextResponse.json({ message: 'Reconciliação anulada com sucesso' });
  } catch (error: any) {
    console.error('Desfazer reconciliação error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao anular a reconciliação' }, { status: 500 });
  }
}
