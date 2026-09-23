export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.caixaMovimento.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, item.contentType || 'application/pdf', item.isPublic, true);
    }
    return NextResponse.json({ ...item, url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    const updateData: any = {};
    if (body.descricao !== undefined) updateData.descricao = body.descricao;
    if (body.valor !== undefined) updateData.valor = Number(body.valor) || 0;
    if (body.data !== undefined) updateData.data = new Date(body.data);
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.categoria !== undefined) updateData.categoria = body.categoria || null;
    if (body.notas !== undefined) updateData.notas = body.notas || null;
    if (body.contaBancariaId !== undefined) updateData.contaBancariaId = body.contaBancariaId || null;
    if (body.cloudStoragePath !== undefined) updateData.cloudStoragePath = body.cloudStoragePath;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.nomeOriginal !== undefined) updateData.nomeOriginal = body.nomeOriginal;
    const data = await prisma.caixaMovimento.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.caixaMovimento.findUnique({ where: { id: params.id } });
    if (item?.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    await prisma.caixaMovimento.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
