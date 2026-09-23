export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fornecedores = await prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    return NextResponse.json(fornecedores ?? []);
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
    const { nome, nif, email, telefone, morada, cidade, codigoPostal, website, contactoNome, contactoEmail, contactoTel, notas, tipoFornecedor } = body ?? {};

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

    const fornecedor = await prisma.fornecedor.create({
      data: { nome, nif: nif ?? null, email: email ?? null, telefone: telefone ?? null, morada: morada ?? null, cidade: cidade ?? null, codigoPostal: codigoPostal ?? null, website: website ?? null, contactoNome: contactoNome ?? null, contactoEmail: contactoEmail ?? null, contactoTel: contactoTel ?? null, notas: notas ?? null, tipoFornecedor: tipoFornecedor ?? null },
    });

    return NextResponse.json(fornecedor, { status: 201 });
  } catch (error: any) {
    console.error(error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'NIF já existe' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar fornecedor' }, { status: 500 });
  }
}
