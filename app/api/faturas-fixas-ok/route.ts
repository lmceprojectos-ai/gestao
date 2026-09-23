export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Confirmações manuais de faturas fixas dadas como OK (fatura já digitalizada,
// mas não detetada automaticamente).

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const confirmacoes = await prisma.faturaFixaConfirmacao.findMany({
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
    return NextResponse.json(confirmacoes ?? []);
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
    const { id, fornecedor, ano, mes, notas, faturaId, faturaNumero } = body ?? {};

    // Edição de uma confirmação existente (ex.: associar/alterar fatura).
    if (id) {
      const atualizada = await prisma.faturaFixaConfirmacao.update({
        where: { id: String(id) },
        data: {
          notas: notas ?? null,
          faturaId: faturaId ?? null,
          faturaNumero: faturaNumero ?? null,
          criadoPor: (session.user as any)?.email ?? null,
        },
      });
      return NextResponse.json(atualizada);
    }

    if (!fornecedor || ano === undefined || ano === null || mes === undefined || mes === null) {
      return NextResponse.json({ error: 'Dados em falta (fornecedor, ano, mes)' }, { status: 400 });
    }

    const anoInt = parseInt(String(ano), 10);
    const mesInt = parseInt(String(mes), 10);

    // Cada confirmação é um novo registo (permite acumular várias faturas por
    // fornecedor/mês, ex.: IFTHENPAY = 3 faturas por mês).
    const confirmacao = await prisma.faturaFixaConfirmacao.create({
      data: {
        fornecedor: String(fornecedor),
        ano: anoInt,
        mes: mesInt,
        notas: notas ?? null,
        faturaId: faturaId ?? null,
        faturaNumero: faturaNumero ?? null,
        criadoPor: (session.user as any)?.email ?? null,
      },
    });
    return NextResponse.json(confirmacao);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fornecedor = searchParams.get('fornecedor');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');

    if (id) {
      await prisma.faturaFixaConfirmacao.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (fornecedor && ano !== null && mes !== null) {
      await prisma.faturaFixaConfirmacao.deleteMany({
        where: { fornecedor, ano: parseInt(ano, 10), mes: parseInt(mes, 10) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Parâmetros em falta' }, { status: 400 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
