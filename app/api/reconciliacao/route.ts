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
    const { movimentoId, recebimentoId, pagamentoId } = body ?? {};

    if (!movimentoId || (!recebimentoId && !pagamentoId)) {
      return NextResponse.json({ error: 'Movimento e recebimento/pagamento são obrigatórios' }, { status: 400 });
    }

    // Atualizar movimento
    await prisma.movimentoBancario.update({
      where: { id: movimentoId },
      data: {
        reconciliado: true,
        recebimentoId: recebimentoId || null,
        pagamentoId: pagamentoId || null,
      },
    });

    // Atualizar recebimento/pagamento
    if (recebimentoId) {
      await prisma.recebimento.update({
        where: { id: recebimentoId },
        data: { reconciliado: true },
      });
    }
    if (pagamentoId) {
      await prisma.pagamento.update({
        where: { id: pagamentoId },
        data: { reconciliado: true },
      });
    }

    return NextResponse.json({ message: 'Reconciliação efetuada com sucesso' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro na reconciliação' }, { status: 500 });
  }
}
