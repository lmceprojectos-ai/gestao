export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const contaId = searchParams.get('contaId');

    const where: any = {};
    if (contaId) where.contaBancariaId = contaId;

    const movimentos = await prisma.movimentoBancario.findMany({
      where,
      orderBy: { dataMovimento: 'desc' },
      include: {
        contaBancaria: { select: { nome: true } },
        despesa: { select: { id: true, descricao: true, valor: true, entidadeNome: true } },
        vencimento: { select: { id: true, funcionario: true, periodo: true } },
        recebimento: {
          include: {
            cliente: { select: { nome: true } },
            fatura: { select: { id: true, numero: true, entidadeNome: true } },
          },
        },
        pagamento: {
          include: {
            fornecedor: { select: { nome: true } },
            fatura: { select: { id: true, numero: true, entidadeNome: true } },
          },
        },
      },
    });
    return NextResponse.json(movimentos ?? []);
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
    const { descricao, valor, dataMovimento, tipo, contaBancariaId } = body ?? {};

    if (!descricao || !valor || !dataMovimento || !tipo || !contaBancariaId) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const movimento = await prisma.movimentoBancario.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        descricao,
        valor: Number(valor),
        dataMovimento: new Date(dataMovimento),
        tipo,
        contaBancariaId,
      },
      include: { contaBancaria: { select: { nome: true } } },
    });

    return NextResponse.json(movimento, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar movimento' }, { status: 500 });
  }
}
