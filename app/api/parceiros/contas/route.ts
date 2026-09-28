export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros } from '@/lib/parceiros/acesso';
import { listarContas } from '@/lib/parceiros/contas';

const limpo = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Parceiros e respetivos saldos. Só a Criaconsensos (administradores).
export async function GET() {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  return NextResponse.json(await listarContas());
}

// Novo parceiro (nova conta corrente) ou alterar um existente ({ id, ... }).
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const nome = limpo(body?.nome);
  const emailAvisos = limpo(body?.emailAvisos);
  if (!nome) return NextResponse.json({ message: 'Indique o nome do parceiro.' }, { status: 400 });
  if (emailAvisos && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAvisos)) return NextResponse.json({ message: 'Email de avisos inválido.' }, { status: 400 });
  const data = { nome, emailAvisos, ativo: body?.ativo !== false };
  const p = body?.id
    ? await prisma.parceiro.update({ where: { id: String(body.id) }, data })
    : await prisma.parceiro.create({ data });
  return NextResponse.json(p);
}
