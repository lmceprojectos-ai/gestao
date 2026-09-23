export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const contas = await prisma.contaBancaria.findMany({ where: { ativa: true }, orderBy: { nome: 'asc' } });
    return NextResponse.json(contas ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao carregar contas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { nome, banco, iban, saldoInicial, dataSaldoInicial } = body ?? {};

    if (!nome || !banco) {
      return NextResponse.json({ error: 'Nome e banco são obrigatórios' }, { status: 400 });
    }

    const conta = await prisma.contaBancaria.create({
      data: {
        nome,
        banco,
        iban: iban ?? null,
        saldoInicial: Number(saldoInicial) || 0,
        saldoAtual: Number(saldoInicial) || 0,
        ...(dataSaldoInicial && { dataSaldoInicial: new Date(dataSaldoInicial) }),
      },
    });

    return NextResponse.json(conta, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 });
  }
}
