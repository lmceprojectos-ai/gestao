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

// Eliminar um parceiro e a sua conta corrente (registos, ligações e documentos).
// Só administradores e só parceiros inativos (desative primeiro, por segurança).
export async function DELETE(request: Request) {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  const p = id ? await prisma.parceiro.findUnique({ where: { id }, include: { transacoes: { select: { attachments: { select: { cloudStoragePath: true } } } } } }) : null;
  if (!p) return NextResponse.json({ message: 'Parceiro não encontrado.' }, { status: 404 });
  if (p.ativo) return NextResponse.json({ message: 'Desative o parceiro antes de o eliminar.' }, { status: 400 });
  const { deleteFile } = await import('@/lib/s3');
  for (const a of p.transacoes.flatMap((t) => t.attachments)) { try { await deleteFile(a.cloudStoragePath); } catch {} }
  await prisma.parceiro.delete({ where: { id: p.id } });
  return NextResponse.json({ ok: true, registos: p.transacoes.length });
}
