export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { iniciarPagamentoMBWay, normalizarTelemovel } from '@/lib/ifthenpay/mbway';

function gerarOrderId(): string {
  const base = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `W${base}${rnd}`.slice(0, 15);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const telemovelInput = String(body?.telemovel || '').trim();
    const telemovel = normalizarTelemovel(telemovelInput);
    if (!telemovel) {
      return NextResponse.json({ error: 'Indique um número de telemóvel válido (9 dígitos).' }, { status: 400 });
    }

    const fatura = await prisma.fatura.findUnique({
      where: { id: params?.id },
      include: { cliente: { select: { nome: true, email: true } } },
    });
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    if (fatura.tipo !== 'emitida' || fatura.origem !== 'cliente') {
      return NextResponse.json({ error: 'O pagamento MB WAY só está disponível para faturas de clientes.' }, { status: 400 });
    }
    if (fatura.pagamentoValidado) {
      return NextResponse.json({ error: 'Esta fatura já se encontra paga.' }, { status: 400 });
    }

    const valor = Number(fatura.valor ?? 0);
    if (!valor || valor <= 0) {
      return NextResponse.json({ error: 'A fatura não tem um valor válido para gerar o pagamento.' }, { status: 400 });
    }

    const orderId = (fatura as any).mbwayOrderId || gerarOrderId();
    const res = await iniciarPagamentoMBWay({
      orderId,
      amount: valor,
      mobileNumber: telemovel,
      description: fatura.numero ? `Fatura ${fatura.numero}` : (fatura.descricao || `Fatura ${fatura.id}`),
      email: fatura.cliente?.email || null,
    });

    if (!res) {
      return NextResponse.json({ error: 'Não foi possível iniciar o pagamento MB WAY. Verifique o número e tente novamente.' }, { status: 502 });
    }

    // Status "000" indica pedido aceite (a aguardar confirmação na app MB WAY).
    const aceite = res.status === '000';

    await prisma.fatura.update({
      where: { id: fatura.id },
      data: {
        mbwayOrderId: orderId,
        mbwayRequestId: res.requestId,
        mbwayEstado: aceite ? 'pendente' : 'erro',
        mbwayTelemovel: telemovel,
        mbwayIniciadoEm: new Date(),
      } as any,
    });

    if (!aceite) {
      return NextResponse.json({ error: res.message || 'O pedido MB WAY não foi aceite.', status: res.status }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      estado: 'pendente',
      telemovel,
      requestId: res.requestId,
      message: res.message || 'Pedido enviado. Confirme o pagamento na app MB WAY.',
    });
  } catch (error: any) {
    console.error('[faturas/mbway] erro:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao iniciar pagamento MB WAY' }, { status: 500 });
  }
}
