export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Reconcile a credit movement with a client invoice (fatura emitida)
// Creates a Recebimento linked to the fatura, then reconciles the movement
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { movimentoId, faturaId } = body ?? {};

    if (!movimentoId || !faturaId) {
      return NextResponse.json({ error: 'Movimento e fatura são obrigatórios' }, { status: 400 });
    }

    // Get the movement
    const movimento = await prisma.movimentoBancario.findUnique({
      where: { id: movimentoId },
    });
    if (!movimento) return NextResponse.json({ error: 'Movimento não encontrado' }, { status: 404 });
    if (movimento.reconciliado) return NextResponse.json({ error: 'Movimento já reconciliado' }, { status: 400 });

    // Get the fatura
    const fatura = await prisma.fatura.findUnique({
      where: { id: faturaId },
      include: { cliente: true },
    });
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    // Create a Recebimento linked to this fatura
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

    // Reconcile the movement with the new recebimento
    await prisma.movimentoBancario.update({
      where: { id: movimentoId },
      data: {
        reconciliado: true,
        recebimentoId: recebimento.id,
      },
    });

    // Marcar o pagamento da fatura como validado (conciliado com movimento bancário)
    await prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        pagamentoValidado: true,
        dataValidacaoPagamento: new Date(),
        validadoPor: session?.user?.name || session?.user?.email || null,
        dataPagamento: movimento.dataMovimento,
        formaPagamento: fatura.formaPagamento || 'transferencia',
      },
    });

    return NextResponse.json({
      message: 'Movimento reconciliado com fatura de cliente',
      recebimentoId: recebimento.id,
    });
  } catch (error: any) {
    console.error('Reconciliação com fatura de cliente error:', error);
    return NextResponse.json({ error: error.message || 'Erro na reconciliação' }, { status: 500 });
  }
}
