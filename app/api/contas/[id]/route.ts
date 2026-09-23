export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const conta = await prisma.contaBancaria.findUnique({ where: { id: params?.id } });
    if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    return NextResponse.json(conta);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { nome, banco, iban, saldoInicial, saldoAtual, dataSaldoInicial, ativa } = body ?? {};

    const conta = await prisma.contaBancaria.update({
      where: { id: params?.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(banco !== undefined && { banco }),
        ...(iban !== undefined && { iban }),
        ...(saldoInicial !== undefined && { saldoInicial: Number(saldoInicial) }),
        ...(saldoAtual !== undefined && { saldoAtual: Number(saldoAtual) }),
        ...(dataSaldoInicial !== undefined && {
          dataSaldoInicial: dataSaldoInicial ? new Date(dataSaldoInicial) : null,
        }),
        ...(ativa !== undefined && { ativa }),
      },
    });

    return NextResponse.json(conta);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const id = params?.id;

    // Verificar dependências
    const [recebimentos, pagamentos, movimentos] = await Promise.all([
      prisma.recebimento.count({ where: { contaBancariaId: id } }),
      prisma.pagamento.count({ where: { contaBancariaId: id } }),
      prisma.movimentoBancario.count({ where: { contaBancariaId: id } }),
    ]);

    if (recebimentos > 0 || pagamentos > 0 || movimentos > 0) {
      // Desassociar registos dependentes e eliminar movimentos
      await prisma.$transaction([
        prisma.recebimento.updateMany({ where: { contaBancariaId: id }, data: { contaBancariaId: null } }),
        prisma.pagamento.updateMany({ where: { contaBancariaId: id }, data: { contaBancariaId: null } }),
        prisma.movimentoBancario.deleteMany({ where: { contaBancariaId: id } }),
      ]);
    }

    await prisma.contaBancaria.delete({ where: { id } });

    return NextResponse.json({ message: 'Conta eliminada com sucesso' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao eliminar conta' }, { status: 500 });
  }
}
