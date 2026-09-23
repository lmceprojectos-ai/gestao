export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const recebimentos = await prisma.recebimento.findMany({
      orderBy: { dataRecebimento: 'desc' },
      include: {
        cliente: { select: { nome: true } },
        contaBancaria: { select: { nome: true } },
        fatura: { select: { id: true, numero: true } },
      },
    });
    return NextResponse.json(recebimentos ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { descricao, valor, dataRecebimento, estado, metodoPagamento, referencia, notas, clienteId, contaBancariaId, faturaId } = body ?? {};

    if (!descricao || !valor || !dataRecebimento) {
      return NextResponse.json({ error: 'Descrição, valor e data são obrigatórios' }, { status: 400 });
    }

    const recebimento = await prisma.recebimento.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        descricao,
        valor: Number(valor),
        dataRecebimento: new Date(dataRecebimento),
        estado: estado ?? 'pendente',
        metodoPagamento: metodoPagamento ?? null,
        referencia: referencia ?? null,
        notas: notas ?? null,
        clienteId: clienteId || null,
        contaBancariaId: contaBancariaId || null,
        faturaId: faturaId || null,
      },
      include: { cliente: { select: { nome: true } }, contaBancaria: { select: { nome: true } } },
    });

    // Atualizar saldo da conta se recebido/pago
    if (['pago', 'recebido'].includes(estado ?? 'pendente') && contaBancariaId) {
      await prisma.contaBancaria.update({
        where: { id: contaBancariaId },
        data: { saldoAtual: { increment: Number(valor) } },
      });
    }

    return NextResponse.json(recebimento, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar recebimento' }, { status: 500 });
  }
}
