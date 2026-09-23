export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password são obrigatórios' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está registado' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? 'Utilizador',
        role: 'admin',
      },
    });

    return NextResponse.json(
      { message: 'Conta criada com sucesso', userId: user.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro no registo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
