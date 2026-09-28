export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar } from '@/lib/parceiros/acesso';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const alloc = await prisma.parceiroAlocacao.findUnique({
    where: { id: params.id },
    include: { payment: { select: { company: true } }, work: { select: { company: true } } },
  });
  if (!alloc) return NextResponse.json({ message: 'Ligação não encontrada.' }, { status: 404 });
  if (!podeAlterar(user, alloc.payment.company) && !podeAlterar(user, alloc.work.company)) return NextResponse.json({ message: 'Sem permissão para remover esta ligação.' }, { status: 403 });
  await prisma.parceiroAlocacao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
