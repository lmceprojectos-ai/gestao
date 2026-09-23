export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    const updateData: any = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.cor !== undefined) updateData.cor = body.cor;
    if (body.ordem !== undefined) updateData.ordem = body.ordem;
    if (body.ativo !== undefined) updateData.ativo = body.ativo;
    const data = await prisma.configuracao.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await prisma.configuracao.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminada' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
