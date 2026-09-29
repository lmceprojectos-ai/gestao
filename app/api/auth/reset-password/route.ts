export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { linkConvite } from '@/lib/parceiros/convite';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token: string = (body?.token ?? '').trim();
    const password: string = body?.password ?? '';

    if (!token || !password) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A palavra-passe deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'A ligação de reposição é inválida ou expirou. Peça uma nova.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) {
      return NextResponse.json(
        { error: 'A ligação de reposição é inválida ou expirou. Peça uma nova.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Para onde ir entrar: parceiros voltam à página de entrada da empresa, com o email preenchido.
    let entrar = `/login?email=${encodeURIComponent(user.email)}`;
    if ((user as any).role === 'parceiro' && (user as any).parceiroId) {
      const p = await prisma.parceiro.findUnique({ where: { id: (user as any).parceiroId } });
      if (p?.ativo) entrar = `${linkConvite(p)}&email=${encodeURIComponent(user.email)}`;
    }
    return NextResponse.json({ message: 'Palavra-passe alterada com sucesso.', entrar });
  } catch (error: any) {
    console.error('Erro em reset-password:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
