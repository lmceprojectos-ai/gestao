export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
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
    if (!body.nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const slug = body.slug || body.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const data = await prisma.categoria.create({
      data: { nome: body.nome, slug, cor: body.cor || 'bg-gray-100 text-gray-700' },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Categoria já existe' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
