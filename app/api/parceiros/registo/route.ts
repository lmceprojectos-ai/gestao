export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { slugParceiro } from '@/lib/parceiros/acesso';
import { conviteValido } from '@/lib/parceiros/convite';

// Criar conta a partir do link de convite de um parceiro. A conta fica com o
// perfil "Parceiro" e só acede à conta corrente desse parceiro.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body?.parceiro ?? '');
  const nome = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').toLowerCase().trim();
  const password = String(body?.password ?? '');

  const parceiro = (await prisma.parceiro.findMany({ where: { ativo: true } })).find((p) => slugParceiro(p.nome) === slug);
  if (!parceiro || !conviteValido(parceiro.id, body?.c)) {
    return NextResponse.json({ error: 'Link de convite inválido. Peça um novo link à Criaconsensos.' }, { status: 403 });
  }
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Indique o nome e um email válido.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'A palavra-passe deve ter pelo menos 8 caracteres.' }, { status: 400 });

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    return NextResponse.json({ error: 'Já existe uma conta com este email. Use "Entrar" ou "Esqueci-me da palavra-passe".' }, { status: 409 });
  }
  await prisma.user.create({
    data: { name: nome, email, password: await bcrypt.hash(password, 12), role: 'parceiro', parceiroId: parceiro.id },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
