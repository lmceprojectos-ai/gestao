export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, acessoConta, podeAlterar } from '@/lib/parceiros/acesso';

// PATCH { liquidado: boolean } — marca (ou desmarca) um registo como liquidado à mão,
// sem o ligar a um pagamento. Só muda o estado; os saldos não mudam.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const existing = await prisma.parceiroTransacao.findUnique({ where: { id: params.id } });
  if (!existing || !acessoConta(user, existing.parceiroId)) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
  if (!podeAlterar(user, existing)) return NextResponse.json({ message: 'Só pode alterar os registos da sua empresa.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  await prisma.parceiroTransacao.update({ where: { id: params.id }, data: { liquidado: body?.liquidado === true } });
  return NextResponse.json({ ok: true });
}
