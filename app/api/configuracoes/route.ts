export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const grupo = req.nextUrl.searchParams.get('grupo');
    const where = grupo ? { grupo } : {};
    const data = await prisma.configuracao.findMany({
      where,
      orderBy: [{ grupo: 'asc' }, { ordem: 'asc' }, { label: 'asc' }],
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.grupo) return NextResponse.json({ error: 'Grupo é obrigatório' }, { status: 400 });
    if (!body.label) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const valor = body.valor || slugify(body.label);
    if (!valor) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
    const count = await prisma.configuracao.count({ where: { grupo: body.grupo } });
    const data = await prisma.configuracao.create({
      data: {
        grupo: body.grupo,
        valor,
        label: body.label,
        cor: body.cor ?? null,
        ordem: body.ordem ?? count + 1,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Já existe um registo com este nome neste grupo' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
