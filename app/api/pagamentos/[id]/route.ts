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
    const old = await prisma.pagamento.findUnique({ where: { id: params?.id } });
    if (!old) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const { descricao, valor, dataPagamento, estado, metodoPagamento, referencia, notas, fornecedorId, contaBancariaId, faturaId, reconciliado, reciboPath, reciboContentType, reciboOriginal, comprovativoPath, comprovativoContentType, comprovativoOriginal } = body ?? {};

    // Valores efetivos após a atualização (o body pode ser parcial)
    const novoEstado = estado !== undefined ? estado : old.estado;
    const novoValor = valor !== undefined ? Number(valor) : old.valor;
    const novaConta = contaBancariaId !== undefined ? (contaBancariaId || null) : old.contaBancariaId;

    const pagamento = await prisma.$transaction(async (tx) => {
      const upd = await tx.pagamento.update({
        where: { id: params?.id },
        data: {
          ...(descricao !== undefined && { descricao }),
          ...(valor !== undefined && { valor: Number(valor) }),
          ...(dataPagamento !== undefined && { dataPagamento: new Date(dataPagamento) }),
          ...(estado !== undefined && { estado }),
          ...(metodoPagamento !== undefined && { metodoPagamento: metodoPagamento || null }),
          ...(referencia !== undefined && { referencia: referencia || null }),
          ...(notas !== undefined && { notas: notas || null }),
          ...(fornecedorId !== undefined && { fornecedorId: fornecedorId || null }),
          ...(contaBancariaId !== undefined && { contaBancariaId: contaBancariaId || null }),
          ...(faturaId !== undefined && { faturaId: faturaId || null }),
          ...(reconciliado !== undefined && { reconciliado: !!reconciliado }),
          ...(reciboPath !== undefined && { reciboPath: reciboPath || null }),
          ...(reciboContentType !== undefined && { reciboContentType: reciboContentType || null }),
          ...(reciboOriginal !== undefined && { reciboOriginal: reciboOriginal || null }),
          ...(comprovativoPath !== undefined && { comprovativoPath: comprovativoPath || null }),
          ...(comprovativoContentType !== undefined && { comprovativoContentType: comprovativoContentType || null }),
          ...(comprovativoOriginal !== undefined && { comprovativoOriginal: comprovativoOriginal || null }),
        },
        include: { fornecedor: { select: { nome: true } }, contaBancaria: { select: { nome: true } } },
      });

      // Reverter o efeito antigo no saldo (pagamento pago subtrai ao saldo)
      if (old.estado === 'pago' && old.contaBancariaId) {
        await tx.contaBancaria.update({
          where: { id: old.contaBancariaId },
          data: { saldoAtual: { increment: Number(old.valor) } },
        });
      }
      // Aplicar o novo efeito no saldo
      if (novoEstado === 'pago' && novaConta) {
        await tx.contaBancaria.update({
          where: { id: novaConta },
          data: { saldoAtual: { decrement: Number(novoValor) } },
        });
      }
      return upd;
    });

    return NextResponse.json(pagamento);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const old = await prisma.pagamento.findUnique({ where: { id: params?.id } });
    if (!old) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Reverter o efeito no saldo se estava pago
      if (old.estado === 'pago' && old.contaBancariaId) {
        await tx.contaBancaria.update({
          where: { id: old.contaBancariaId },
          data: { saldoAtual: { increment: Number(old.valor) } },
        });
      }
      await tx.pagamento.delete({ where: { id: params?.id } });
    });

    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
