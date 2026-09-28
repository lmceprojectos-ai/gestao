export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar, acessoConta } from '@/lib/parceiros/acesso';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const alloc = await prisma.parceiroAlocacao.findUnique({
    where: { id: params.id },
    include: { payment: { select: { company: true, parceiroId: true } }, work: { select: { company: true, parceiroId: true } } },
  });
  if (!alloc || !acessoConta(user, alloc.payment.parceiroId)) return NextResponse.json({ message: 'Ligação não encontrada.' }, { status: 404 });
  if (!podeAlterar(user, alloc.payment) && !podeAlterar(user, alloc.work)) return NextResponse.json({ message: 'Sem permissão para remover esta ligação.' }, { status: 403 });
  await prisma.parceiroAlocacao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
