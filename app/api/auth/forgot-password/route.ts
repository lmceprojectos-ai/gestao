export const dynamic = 'force-dynamic';

import { enviarEmailPalavraPasse } from '@/lib/reposicao-palavra-passe';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = (body?.email ?? '').trim().toLowerCase();

    // Always respond with success to avoid revealing which emails exist.
    const genericResponse = NextResponse.json({
      message:
        'Se existir uma conta associada a este email, receberá uma mensagem com instruções para repor a palavra-passe.',
    });

    if (!email) {
      return genericResponse;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return genericResponse;
    }

    await enviarEmailPalavraPasse({ email, nome: user.name });

    return genericResponse;
  } catch (error: any) {
    console.error('Erro em forgot-password:', error);
    return NextResponse.json(
      { message: 'Se existir uma conta associada a este email, receberá uma mensagem com instruções.' },
    );
  }
}
