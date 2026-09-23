export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const clientes = await prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    return NextResponse.json(clientes ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { nome, nif, email, telefone, morada, cidade, codigoPostal, website, redesSociais, contactoNome, contactoEmail, contactoTel, notas } = body ?? {};

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

    const cliente = await prisma.cliente.create({
      data: { nome, nif: nif ?? null, email: email ?? null, telefone: telefone ?? null, morada: morada ?? null, cidade: cidade ?? null, codigoPostal: codigoPostal ?? null, website: website ?? null, redesSociais: redesSociais ?? null, contactoNome: contactoNome ?? null, contactoEmail: contactoEmail ?? null, contactoTel: contactoTel ?? null, notas: notas ?? null },
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error: any) {
    console.error(error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'NIF já existe' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
  }
}
