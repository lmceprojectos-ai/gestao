export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { registarPagamentoConfirmado } from '@/lib/faturas/registar-pagamento';

function parseDataPagamento(raw: string | null): Date {
  if (!raw) return new Date();
  // IfThenPay envia normalmente "yyyy-MM-dd HH:mm:ss"
  const s = raw.trim().replace(' ', 'T');
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const d2 = new Date(raw);
  return isNaN(d2.getTime()) ? new Date() : d2;
}

async function processar(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('key') || sp.get('chave') || '';
  const expected = process.env.IFTHENPAY_ANTIPHISHING_KEY || '';

  if (!expected || key !== expected) {
    console.warn('[ifthenpay/callback] Chave anti-phishing inválida.');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const orderId = sp.get('orderId') || sp.get('order_id') || '';
  const amount = sp.get('amount') || '';
  const entity = sp.get('entity') || sp.get('entidade') || '';
  const reference = sp.get('reference') || sp.get('referencia') || '';
  const requestId = sp.get('requestId') || sp.get('request_id') || '';
  const paymentDatetime = sp.get('payment_datetime') || sp.get('paymentDatetime') || '';

  console.log('[ifthenpay/callback] Recebido', JSON.stringify({ orderId, amount, entity, reference, requestId, paymentDatetime }));

  // Localizar a fatura e identificar o método:
  //  1) Multibanco por mbOrderId; 2) MB WAY por mbwayOrderId; 3) Multibanco por referência.
  let fatura = null as Awaited<ReturnType<typeof prisma.fatura.findFirst>> | null;
  let metodo: 'multibanco' | 'mbway' = 'multibanco';
  if (orderId) {
    fatura = await prisma.fatura.findFirst({ where: { mbOrderId: orderId } as any });
    if (!fatura) {
      fatura = await prisma.fatura.findFirst({ where: { mbwayOrderId: orderId } as any });
      if (fatura) metodo = 'mbway';
    }
  }
  if (!fatura && reference) {
    fatura = await prisma.fatura.findFirst({
      where: entity
        ? ({ mbReferencia: reference, mbEntidade: entity } as any)
        : ({ mbReferencia: reference } as any),
    });
  }

  if (!fatura) {
    console.error('[ifthenpay/callback] Fatura não encontrada para orderId/referência.');
    // Devolver 200 para evitar retries infinitos por referências desconhecidas.
    return new NextResponse('OK', { status: 200 });
  }

  // Idempotência: se já está paga, não reprocessar.
  if (fatura.pagamentoValidado) {
    console.log('[ifthenpay/callback] Fatura já validada, ignorado.', fatura.id);
    return new NextResponse('OK', { status: 200 });
  }

  const dataPagamento = parseDataPagamento(paymentDatetime);
  const valorPago = Number(amount) || Number(fatura.valor ?? 0);

  await registarPagamentoConfirmado(fatura, {
    metodo,
    valorPago,
    dataPagamento,
    entity,
    reference,
    requestId,
  });

  console.log('[ifthenpay/callback] Fatura marcada como paga:', fatura.id);
  return new NextResponse('OK', { status: 200 });
}

export async function GET(req: NextRequest) {
  try {
    return await processar(req);
  } catch (error: any) {
    console.error('[ifthenpay/callback] Erro:', error?.message || error);
    return new NextResponse('Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await processar(req);
  } catch (error: any) {
    console.error('[ifthenpay/callback] Erro:', error?.message || error);
    return new NextResponse('Error', { status: 500 });
  }
}
