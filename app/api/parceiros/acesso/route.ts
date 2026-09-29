export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { slugParceiro } from '@/lib/parceiros/acesso';
import { conviteValido } from '@/lib/parceiros/convite';
import { enviarEmailPalavraPasse } from '@/lib/reposicao-palavra-passe';

// Primeiro acesso / repor a palavra-passe, a partir do link de convite do parceiro.
//  - já existe conta deste parceiro com o email → email para repor a palavra-passe;
//  - não existe conta e o email é o de contacto ou de faturação da ficha do parceiro
//    → cria a conta (perfil "Parceiro", sem palavra-passe utilizável) e envia o
//    email para a definir. Só quem recebe esses emails consegue ativar o acesso.
// A resposta é sempre a mesma, para não revelar que emails existem.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? '').toLowerCase().trim();
  const parceiro = (await prisma.parceiro.findMany({ where: { ativo: true } })).find((p) => slugParceiro(p.nome) === String(body?.parceiro ?? ''));
  if (!parceiro || !conviteValido(parceiro.id, body?.c)) {
    return NextResponse.json({ error: 'Link de convite inválido. Peça um novo link à Criaconsensos.' }, { status: 403 });
  }
  const resposta = NextResponse.json({
    message: 'Se este email tiver acesso à conta corrente, vai receber uma mensagem para definir a palavra-passe. Veja também a pasta de spam.',
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (user.role === 'parceiro' && user.parceiroId === parceiro.id && user.active !== false) {
      await enviarEmailPalavraPasse({ email, nome: user.name, primeiroAcesso: !user.lastLogin, empresa: parceiro.nome });
    }
    return resposta;
  }
  const emailsDaFicha = [parceiro.emailAvisos, parceiro.emailFaturacao].filter(Boolean).map((e) => e!.toLowerCase().trim());
  if (!emailsDaFicha.includes(email)) return resposta;

  await prisma.user.create({
    data: {
      name: parceiro.nome, email, role: 'parceiro', parceiroId: parceiro.id,
      // Palavra-passe aleatória que ninguém conhece: a conta só se usa depois de definir a sua.
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
    },
  });
  await enviarEmailPalavraPasse({ email, nome: parceiro.nome, primeiroAcesso: true, empresa: parceiro.nome });
  return resposta;
}
