export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, acessoConta, podeAlterar } from '@/lib/parceiros/acesso';
import { lerRegisto } from '@/lib/parceiros/registo';
import { enrich, movementOf, typeLabels } from '@/lib/parceiros/calc';
import type { TransactionType, PaymentDirection } from '@/lib/parceiros/calc';
import { getAllDTO } from '@/lib/parceiros/server-tx';
import { notifyChange } from '@/lib/parceiros/notify';
import { formatDatePT } from '@/lib/parceiros/format';

async function registoComConta(id: string) {
  return prisma.parceiroTransacao.findUnique({ where: { id }, include: { parceiro: true, attachments: true } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const existing = await registoComConta(params.id);
    if (!existing?.parceiro || !acessoConta(user, existing.parceiroId)) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (!podeAlterar(user, existing)) return NextResponse.json({ message: 'Só pode editar os registos criados pela sua empresa.' }, { status: 403 });
    const lido = lerRegisto(await request.json().catch(() => ({})), user);
    if ('erro' in lido) return NextResponse.json({ message: lido.erro }, { status: lido.status });
    const { date, description, reference, amount, type, paymentDirection, isBilled, notify } = lido;
    await prisma.parceiroTransacao.update({
      where: { id: params.id },
      data: { date: new Date(`${date}T00:00:00.000Z`), description, reference, amount, type, paymentDirection, isBilled },
    });
    if (notify) {
      const { totals } = enrich(await getAllDTO(existing.parceiro.id));
      await notifyChange({
        parceiro: existing.parceiro, action: 'editado', actor: user.name,
        summary: { date: formatDatePT(date), description, reference, typeLabel: typeLabels(existing.parceiro.nome)[type], amount: movementOf({ type, amount, paymentDirection }), isBilled },
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
    const existing = await registoComConta(params.id);
    if (!existing?.parceiro || !acessoConta(user, existing.parceiroId)) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (!podeAlterar(user, existing)) return NextResponse.json({ message: 'Só pode eliminar os registos criados pela sua empresa.' }, { status: 403 });
    const type = existing.type as TransactionType;
    const amount = Number(existing.amount ?? 0);
    const paymentDirection = (existing.paymentDirection ?? null) as PaymentDirection | null;
    await prisma.parceiroTransacao.delete({ where: { id: params.id } });
    const { deleteFile } = await import('@/lib/s3');
    for (const a of existing.attachments) { try { await deleteFile(a.cloudStoragePath); } catch {} }
    if (new URL(request.url).searchParams.get('notify') !== 'false') {
      const { totals } = enrich(await getAllDTO(existing.parceiro.id));
      await notifyChange({
        parceiro: existing.parceiro, action: 'eliminado', actor: user.name,
        summary: { date: formatDatePT(existing.date.toISOString().slice(0, 10)), description: existing.description, reference: existing.reference ?? null, typeLabel: typeLabels(existing.parceiro.nome)[type], amount: movementOf({ type, amount, paymentDirection }), isBilled: existing.isBilled },
        totals,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Parceiros DELETE', e);
    return NextResponse.json({ message: 'Erro ao eliminar registo.' }, { status: 500 });
  }
}
