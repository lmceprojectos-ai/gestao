export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros } from '@/lib/parceiros/acesso';
import { listarContas } from '@/lib/parceiros/contas';

const limpo = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NIF português: 9 algarismos com dígito de controlo (outros países: aceita o que vier).
function nifPortuguesValido(nif: string) {
  if (!/^\d{9}$/.test(nif)) return false;
  const soma = [...nif.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  return Number(nif[8]) === (resto < 2 ? 0 : 11 - resto);
}

// Parceiros e respetivos saldos. Só a Criaconsensos (administradores).
export async function GET() {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  return NextResponse.json(await listarContas());
}

// Novo parceiro (nova ficha e conta corrente) ou alterar a ficha de um existente ({ id, ... }).
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const nome = limpo(body?.nome);
  const emailAvisos = limpo(body?.emailAvisos);
  const emailFaturacao = limpo(body?.emailFaturacao);
  const pais = limpo(body?.pais) ?? 'Portugal';
  const nif = limpo(body?.nif)?.replace(/\s+/g, '').replace(/^PT/i, '') ?? null;
  if (!nome) return NextResponse.json({ message: 'Indique o nome da empresa.' }, { status: 400 });
  if (emailAvisos && !EMAIL.test(emailAvisos)) return NextResponse.json({ message: 'Email de contacto inválido.' }, { status: 400 });
  if (emailFaturacao && !EMAIL.test(emailFaturacao)) return NextResponse.json({ message: 'Email de faturação inválido.' }, { status: 400 });
  if (nif && /^portugal$/i.test(pais) && !nifPortuguesValido(nif)) return NextResponse.json({ message: 'NIF inválido (confirme os 9 algarismos).' }, { status: 400 });
  const data = {
    nome, emailAvisos, emailFaturacao, nif, pais, ativo: body?.ativo !== false,
    morada: limpo(body?.morada), codigoPostal: limpo(body?.codigoPostal), localidade: limpo(body?.localidade),
    responsavel: limpo(body?.responsavel), telefone: limpo(body?.telefone),
  };
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
