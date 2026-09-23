export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const old = await prisma.recebimento.findUnique({ where: { id: params?.id } });
    if (!old) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const { descricao, valor, dataRecebimento, estado, metodoPagamento, referencia, notas, clienteId, contaBancariaId, faturaId } = body ?? {};

    // Valores efetivos após a atualização (o body pode ser parcial)
    const novoEstado = estado !== undefined ? estado : old.estado;
    const novoValor = valor !== undefined ? Number(valor) : old.valor;
    const novaConta = contaBancariaId !== undefined ? (contaBancariaId || null) : old.contaBancariaId;

    const recebimento = await prisma.$transaction(async (tx) => {
      const upd = await tx.recebimento.update({
        where: { id: params?.id },
        data: {
          ...(descricao !== undefined && { descricao }),
          ...(valor !== undefined && { valor: Number(valor) }),
          ...(dataRecebimento !== undefined && { dataRecebimento: new Date(dataRecebimento) }),
          ...(estado !== undefined && { estado }),
          ...(metodoPagamento !== undefined && { metodoPagamento: metodoPagamento || null }),
          ...(referencia !== undefined && { referencia: referencia || null }),
          ...(notas !== undefined && { notas: notas || null }),
          ...(clienteId !== undefined && { clienteId: clienteId || null }),
          ...(contaBancariaId !== undefined && { contaBancariaId: contaBancariaId || null }),
          ...(faturaId !== undefined && { faturaId: faturaId || null }),
        },
        include: { cliente: { select: { nome: true } }, contaBancaria: { select: { nome: true } } },
      });

      // Reverter o efeito antigo no saldo (recebimento recebido/pago soma ao saldo)
      if (['pago', 'recebido'].includes(old.estado) && old.contaBancariaId) {
        await tx.contaBancaria.update({
          where: { id: old.contaBancariaId },
          data: { saldoAtual: { decrement: Number(old.valor) } },
        });
      }
      // Aplicar o novo efeito no saldo
      if (['pago', 'recebido'].includes(novoEstado) && novaConta) {
        await tx.contaBancaria.update({
          where: { id: novaConta },
          data: { saldoAtual: { increment: Number(novoValor) } },
        });
      }
      return upd;
    });

    return NextResponse.json(recebimento);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const old = await prisma.recebimento.findUnique({ where: { id: params?.id } });
    if (!old) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Reverter o efeito no saldo se estava recebido/pago
      if (['pago', 'recebido'].includes(old.estado) && old.contaBancariaId) {
        await tx.contaBancaria.update({
          where: { id: old.contaBancariaId },
          data: { saldoAtual: { decrement: Number(old.valor) } },
        });
      }
      await tx.recebimento.delete({ where: { id: params?.id } });
    });

    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
