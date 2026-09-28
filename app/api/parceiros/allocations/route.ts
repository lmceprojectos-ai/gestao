export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar, acessoConta } from '@/lib/parceiros/acesso';

function round2(n: number): number {
  return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
}

// Liga um pagamento a um trabalho (débito ou crédito), com valor parcial ou total.
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const paymentId = String(body?.paymentId ?? '').trim();
    const workId = String(body?.workId ?? '').trim();
    const amount = round2(Number(body?.amount ?? 0));
    if (!paymentId || !workId || !(amount > 0)) return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    if (paymentId === workId) return NextResponse.json({ message: 'Não é possível ligar um registo a si próprio.' }, { status: 400 });
    const [payment, work] = await Promise.all([
      prisma.parceiroTransacao.findUnique({ where: { id: paymentId } }),
      prisma.parceiroTransacao.findUnique({ where: { id: workId } }),
    ]);
    if (!payment || !work || !acessoConta(user, payment.parceiroId) || payment.parceiroId !== work.parceiroId) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (payment.type !== 'PAYMENT') return NextResponse.json({ message: 'A ligação tem de partir de um pagamento.' }, { status: 400 });
    if (work.type !== 'DEBIT' && work.type !== 'CREDIT') return NextResponse.json({ message: 'Só pode ligar um pagamento a um trabalho (débito ou crédito).' }, { status: 400 });
    if (!podeAlterar(user, payment) && !podeAlterar(user, work)) return NextResponse.json({ message: 'Sem permissão para reconciliar estes registos.' }, { status: 403 });
    const existing = await prisma.parceiroAlocacao.findUnique({ where: { paymentId_workId: { paymentId, workId } } });
    if (existing) return NextResponse.json({ message: 'Estes registos já estão ligados.' }, { status: 409 });
    const [pay, wrk] = await Promise.all([
      prisma.parceiroAlocacao.aggregate({ where: { paymentId }, _sum: { amount: true } }),
      prisma.parceiroAlocacao.aggregate({ where: { workId }, _sum: { amount: true } }),
    ]);
    const payRemaining = round2(Number(payment.amount) - Number(pay._sum.amount ?? 0));
    const workRemaining = round2(Number(work.amount) - Number(wrk._sum.amount ?? 0));
    if (amount - 0.001 > payRemaining) return NextResponse.json({ message: `Valor excede o disponível do pagamento (${payRemaining.toFixed(2)} €).` }, { status: 400 });
    if (amount - 0.001 > workRemaining) return NextResponse.json({ message: `Valor excede o em falta do trabalho (${workRemaining.toFixed(2)} €).` }, { status: 400 });
    const created = await prisma.parceiroAlocacao.create({ data: { paymentId, workId, amount, createdById: user.id } });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error('Parceiros alocação', e);
    return NextResponse.json({ message: 'Erro ao criar a ligação.' }, { status: 500 });
  }
}
