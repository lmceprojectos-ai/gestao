export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const items = await prisma.transferenciaInterna.findMany({ orderBy: { data: 'desc' } });
    // enrich with conta names
    const contas = await prisma.contaBancaria.findMany({ select: { id: true, nome: true, banco: true } });
    const contaMap = Object.fromEntries(contas.map(c => [c.id, c]));
    const enriched = items.map(t => ({
      ...t,
      contaOrigem: contaMap[t.contaOrigemId] || null,
      contaDestino: contaMap[t.contaDestinoId] || null,
    }));
    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('GET transferencias error:', error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await request.json();
    const { descricao, valor, data, contaOrigemId, contaDestinoId } = body;
    if (!valor || !contaOrigemId || !contaDestinoId) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }
    if (contaOrigemId === contaDestinoId) {
      return NextResponse.json({ error: 'Conta origem e destino não podem ser iguais' }, { status: 400 });
    }

    // Create transfer and update both account balances in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transferenciaInterna.create({
        data: { descricao, valor: parseFloat(valor), data: data ? new Date(data) : new Date(), contaOrigemId, contaDestinoId, criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null },
      });
      await tx.contaBancaria.update({
        where: { id: contaOrigemId },
        data: { saldoAtual: { decrement: parseFloat(valor) } },
      });
      await tx.contaBancaria.update({
        where: { id: contaDestinoId },
        data: { saldoAtual: { increment: parseFloat(valor) } },
      });
      return transfer;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('POST transferencias error:', error);
    return NextResponse.json({ error: 'Erro ao criar transferência' }, { status: 500 });
  }
}
