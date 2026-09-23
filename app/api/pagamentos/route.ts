export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const pagamentos = await prisma.pagamento.findMany({
      orderBy: { dataPagamento: 'desc' },
      include: {
        fornecedor: { select: { nome: true } },
        contaBancaria: { select: { nome: true } },
        fatura: { select: { id: true, numero: true } },
      },
    });
    return NextResponse.json(pagamentos ?? []);
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
    const { descricao, valor, dataPagamento, estado, metodoPagamento, referencia, notas, fornecedorId, contaBancariaId, faturaId, reconciliado, reciboPath, reciboContentType, reciboOriginal, comprovativoPath, comprovativoContentType, comprovativoOriginal } = body ?? {};

    if (!descricao || !valor || !dataPagamento) {
      return NextResponse.json({ error: 'Descrição, valor e data são obrigatórios' }, { status: 400 });
    }
    if (!fornecedorId) {
      return NextResponse.json({ error: 'O fornecedor é obrigatório' }, { status: 400 });
    }

    const pagamento = await prisma.pagamento.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        descricao,
        valor: Number(valor),
        dataPagamento: new Date(dataPagamento),
        estado: estado ?? 'pendente',
        metodoPagamento: metodoPagamento ?? null,
        referencia: referencia ?? null,
        notas: notas ?? null,
        fornecedorId: fornecedorId || null,
        contaBancariaId: contaBancariaId || null,
        faturaId: faturaId || null,
        reconciliado: !!reconciliado,
        reciboPath: reciboPath || null,
        reciboContentType: reciboContentType || null,
        reciboOriginal: reciboOriginal || null,
        comprovativoPath: comprovativoPath || null,
        comprovativoContentType: comprovativoContentType || null,
        comprovativoOriginal: comprovativoOriginal || null,
      },
      include: { fornecedor: { select: { nome: true } }, contaBancaria: { select: { nome: true } } },
    });

    // Atualizar saldo
    if ((estado ?? 'pendente') === 'pago' && contaBancariaId) {
      await prisma.contaBancaria.update({
        where: { id: contaBancariaId },
        data: { saldoAtual: { decrement: Number(valor) } },
      });
    }

    return NextResponse.json(pagamento, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 });
  }
}
