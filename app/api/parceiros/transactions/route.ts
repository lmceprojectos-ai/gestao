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

export async function GET() {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const { rows, totals } = enrich(await getAllDTO());
    return NextResponse.json({ rows, totals });
  } catch (e) {
    console.error('Parceiros GET', e);
    return NextResponse.json({ message: 'Erro ao carregar registos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
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

    const last = await prisma.parceiroTransacao.findFirst({ orderBy: { orderIndex: 'desc' }, select: { orderIndex: true } });
    // O administrador pode registar em nome da outra empresa (crédito da Reclamarte, etc.).
    const company = user.isAdmin && type === 'CREDIT' ? 'RECLAMARTE' : user.isAdmin && type === 'DEBIT' ? 'CRIACONSENSOS'
      : user.isAdmin && type === 'PAYMENT' && paymentDirection === 'B_PAYS_A' ? 'RECLAMARTE' : user.company ?? 'CRIACONSENSOS';
    const created = await prisma.parceiroTransacao.create({
      data: {
        date: new Date(`${dateStr}T00:00:00.000Z`), description, reference, amount, type, paymentDirection, isBilled,
        orderIndex: (last?.orderIndex ?? 0) + 1, company, createdById: user.id,
      },
    });
    if (shouldNotify) {
      const { totals } = enrich(await getAllDTO());
      await notifyChange({
        action: 'criado', actor: user.name,
        summary: { date: formatDatePT(dateStr), description, reference, typeLabel: TYPE_LABELS[type], amount: movementOf({ type, amount, paymentDirection }), isBilled },
        totals,
      });
    }
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error('Parceiros POST', e);
    return NextResponse.json({ message: 'Erro ao criar registo.' }, { status: 500 });
  }
}
