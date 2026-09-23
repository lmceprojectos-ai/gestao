export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Reconcile a debit movement with a fatura (supplier invoice)
// Creates a Pagamento linked to the fatura, then reconciles the movement
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
      include: { fornecedor: true },
    });
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    // Create a Pagamento linked to this fatura
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

    // Reconcile the movement with the new pagamento
    await prisma.movimentoBancario.update({
      where: { id: movimentoId },
      data: {
        reconciliado: true,
        pagamentoId: pagamento.id,
      },
    });

    return NextResponse.json({
      message: 'Movimento reconciliado com fatura',
      pagamentoId: pagamento.id,
    });
  } catch (error: any) {
    console.error('Reconciliação com fatura error:', error);
    return NextResponse.json({ error: error.message || 'Erro na reconciliação' }, { status: 500 });
  }
}
