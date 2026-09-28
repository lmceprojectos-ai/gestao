export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar } from '@/lib/parceiros/acesso';
import { enrich, movementOf, TYPE_LABELS } from '@/lib/parceiros/calc';
import type { TransactionType, PaymentDirection } from '@/lib/parceiros/calc';
import { getAllDTO } from '@/lib/parceiros/server-tx';
import { notifyChange } from '@/lib/parceiros/notify';
import { formatDatePT } from '@/lib/parceiros/format';

function round2(n: number): number {
  return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const existing = await prisma.parceiroTransacao.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (!podeAlterar(user, existing.company)) return NextResponse.json({ message: 'Só pode editar os registos criados pela sua empresa.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const description = String(body?.description ?? '').trim();
  const reference = body?.reference ? String(body.reference).trim() : null;
  const dateStr = String(body?.date ?? '').slice(0, 10);
  const type = String(body?.type ?? '') as TransactionType;
  const amount = Math.max(0, round2(Number(body?.amount ?? 0)));
  const isBilled = Boolean(body?.isBilled);
  const shouldNotify = body?.notify !== false;
  const paymentDirection: PaymentDirection | null = type === 'PAYMENT' ? ((body?.paymentDirection as PaymentDirection) ?? 'A_PAYS_B') : null;
  if (!description || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !['DEBIT', 'CREDIT', 'PAYMENT'].includes(type)) {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }
  if (!user.isAdmin) {
    if (type === 'DEBIT' && user.company !== 'CRIACONSENSOS') return NextResponse.json({ message: 'Apenas a Criaconsensos pode registar débitos.' }, { status: 403 });
    if (type === 'CREDIT' && user.company !== 'RECLAMARTE') return NextResponse.json({ message: 'Apenas a Reclamarte pode registar créditos.' }, { status: 403 });
  }

    await prisma.parceiroTransacao.update({
      where: { id: params.id },
      data: { date: new Date(`${dateStr}T00:00:00.000Z`), description, reference, amount, type, paymentDirection, isBilled },
    });
    if (shouldNotify) {
      const { totals } = enrich(await getAllDTO());
      await notifyChange({
        action: 'editado', actor: user.name,
        summary: { date: formatDatePT(dateStr), description, reference, typeLabel: TYPE_LABELS[type], amount: movementOf({ type, amount, paymentDirection }), isBilled },
        totals,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Parceiros PUT', e);
    return NextResponse.json({ message: 'Erro ao atualizar registo.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const existing = await prisma.parceiroTransacao.findUnique({ where: { id: params.id }, include: { attachments: true } });
    if (!existing) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (!podeAlterar(user, existing.company)) return NextResponse.json({ message: 'Só pode eliminar os registos criados pela sua empresa.' }, { status: 403 });
    const type = existing.type as TransactionType;
    const amount = Number(existing.amount ?? 0);
    const paymentDirection = (existing.paymentDirection ?? null) as PaymentDirection | null;
    await prisma.parceiroTransacao.delete({ where: { id: params.id } });
    const { deleteFile } = await import('@/lib/s3');
    for (const a of existing.attachments) { try { await deleteFile(a.cloudStoragePath); } catch {} }
    if (new URL(request.url).searchParams.get('notify') !== 'false') {
      const { totals } = enrich(await getAllDTO());
      await notifyChange({
        action: 'eliminado', actor: user.name,
        summary: { date: formatDatePT(existing.date.toISOString().slice(0, 10)), description: existing.description, reference: existing.reference ?? null, typeLabel: TYPE_LABELS[type], amount: movementOf({ type, amount, paymentDirection }), isBilled: existing.isBilled },
        totals,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Parceiros DELETE', e);
    return NextResponse.json({ message: 'Erro ao eliminar registo.' }, { status: 500 });
  }
}
