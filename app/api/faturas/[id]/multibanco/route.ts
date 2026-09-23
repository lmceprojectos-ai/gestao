export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { gerarReferenciaMB } from '@/lib/grafica/multibanco';

function gerarOrderId(): string {
  const base = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `F${base}${rnd}`.slice(0, 25);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fatura = await prisma.fatura.findUnique({
      where: { id: params?.id },
      include: { cliente: { select: { nome: true, email: true } } },
    });
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    // Apenas faturas emitidas a clientes
    if (fatura.tipo !== 'emitida' || fatura.origem !== 'cliente') {
      return NextResponse.json({ error: 'A referência Multibanco só está disponível para faturas de clientes.' }, { status: 400 });
    }

    if (fatura.pagamentoValidado) {
      return NextResponse.json({ error: 'Esta fatura já se encontra paga.' }, { status: 400 });
    }

    const valor = Number(fatura.valor ?? 0);
    if (!valor || valor <= 0) {
      return NextResponse.json({ error: 'A fatura não tem um valor válido para gerar a referência.' }, { status: 400 });
    }

    // Reutiliza a referência existente se já foi gerada
    if ((fatura as any).mbReferencia && (fatura as any).mbEntidade && Number((fatura as any).mbValor) === valor) {
      return NextResponse.json({
        entidade: (fatura as any).mbEntidade,
        referencia: (fatura as any).mbReferencia,
        valor: (fatura as any).mbValor,
        reutilizada: true,
      });
    }

    const orderId = (fatura as any).mbOrderId || gerarOrderId();
    const ref = await gerarReferenciaMB({
      orderId,
      amount: valor,
      description: fatura.numero ? `Fatura ${fatura.numero}` : (fatura.descricao || `Fatura ${fatura.id}`),
      clientName: fatura.cliente?.nome || fatura.entidadeNome || null,
      clientEmail: fatura.cliente?.email || null,
    });

    if (!ref) {
      return NextResponse.json({ error: 'Não foi possível gerar a referência Multibanco. Tente novamente.' }, { status: 502 });
    }

    await prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        mbEntidade: ref.entidade,
        mbReferencia: ref.referencia,
        mbValor: ref.valor,
        mbOrderId: orderId,
        mbGeradoEm: new Date(),
      } as any,
    });

    return NextResponse.json({
      entidade: ref.entidade,
      referencia: ref.referencia,
      valor: ref.valor,
      reutilizada: false,
    });
  } catch (error: any) {
    console.error('[faturas/multibanco] erro:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao gerar referência Multibanco' }, { status: 500 });
  }
}
