export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.caixaMovimento.findMany({ orderBy: { data: 'desc' }, include: { contaBancaria: { select: { id: true, nome: true, banco: true } } } });
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
    if (!body.descricao) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    const data = await prisma.caixaMovimento.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        descricao: body.descricao,
        valor: Number(body.valor) || 0,
        data: body.data ? new Date(body.data) : new Date(),
        tipo: body.tipo || 'saida',
        categoria: body.categoria || null,
        notas: body.notas || null,
        contaBancariaId: body.contaBancariaId || null,
        cloudStoragePath: body.cloudStoragePath || null,
        contentType: body.contentType || null,
        nomeOriginal: body.nomeOriginal || null,
        isPublic: body.isPublic || false,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
