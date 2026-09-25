export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Despesas e vencimentos que ainda não estão ligados a nenhum movimento bancário,
// para aparecerem como candidatos na reconciliação de débitos.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const [despesas, vencimentos] = await Promise.all([
      prisma.despesa.findMany({
        where: { movimentosBancarios: { none: {} } },
        orderBy: { data: 'desc' },
        select: {
          id: true, descricao: true, valor: true, data: true, estado: true, categoria: true,
          entidadeNome: true, fornecedor: { select: { nome: true } },
        },
      }),
      prisma.vencimento.findMany({
        where: { movimentosBancarios: { none: {} } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, funcionario: true, valorBruto: true, valorLiquido: true, periodo: true,
          dataPagamento: true, estado: true,
        },
      }),
    ]);
    return NextResponse.json({ despesas, vencimentos });
  } catch (error: any) {
    console.error('Candidatos de reconciliação:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}

// Liga um movimento bancário (débito) a uma despesa ou a um vencimento e
// marca-o como pago com a data e a conta do movimento.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { movimentoId, despesaId, vencimentoId } = (await req.json()) ?? {};
    if (!movimentoId || (!despesaId && !vencimentoId)) {
      return NextResponse.json({ error: 'Movimento e despesa/vencimento são obrigatórios' }, { status: 400 });
    }

    const mov = await prisma.movimentoBancario.findUnique({ where: { id: movimentoId } });
    if (!mov) return NextResponse.json({ error: 'Movimento não encontrado' }, { status: 404 });
    if (mov.reconciliado) return NextResponse.json({ error: 'Movimento já reconciliado' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.movimentoBancario.update({
        where: { id: movimentoId },
        data: { reconciliado: true, despesaId: despesaId || null, vencimentoId: vencimentoId || null },
      });
      if (despesaId) {
        const d = await tx.despesa.findUnique({ where: { id: despesaId } });
        if (!d) throw new Error('Despesa não encontrada');
        await tx.despesa.update({
          where: { id: despesaId },
          data: { estado: 'pago', contaBancariaId: d.contaBancariaId || mov.contaBancariaId },
        });
      }
      if (vencimentoId) {
        const v = await tx.vencimento.findUnique({ where: { id: vencimentoId } });
        if (!v) throw new Error('Vencimento não encontrado');
        await tx.vencimento.update({
          where: { id: vencimentoId },
          data: { estado: 'pago', dataPagamento: v.dataPagamento || mov.dataMovimento },
        });
      }
    });

    return NextResponse.json({ message: 'Reconciliação efetuada com sucesso' });
  } catch (error: any) {
    console.error('Reconciliação com despesa/vencimento:', error);
    return NextResponse.json({ error: error.message || 'Erro na reconciliação' }, { status: 500 });
  }
}
