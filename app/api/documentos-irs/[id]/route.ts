export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';

// Privacidade estrita: um documento só pode ser lido/alterado/eliminado pelo
// utilizador que o criou (userId). Sem override de admin.

async function getOwned(id: string, userId: string) {
  const item = await prisma.documentoIrs.findUnique({ where: { id } });
  if (!item) return { item: null, forbidden: false };
  if (item.userId !== userId) return { item: null, forbidden: true };
  return { item, forbidden: false };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const { item, forbidden } = await getOwned(params.id, userId);
    if (forbidden) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, item.contentType || 'application/pdf', false);
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
    const userId = (session.user as any)?.id;
    const { item, forbidden } = await getOwned(params.id, userId);
    if (forbidden) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    const body = await req.json();
    const updateData: any = {};
    if (body.ano !== undefined) {
      const ano = parseInt(body.ano, 10);
      if (ano && !Number.isNaN(ano)) updateData.ano = ano;
    }
    if (body.descricao !== undefined) updateData.descricao = body.descricao || null;
    if (body.categoria !== undefined) updateData.categoria = body.categoria || null;
    if (body.entidadeNome !== undefined) updateData.entidadeNome = body.entidadeNome?.trim() || null;
    if (body.valor !== undefined) {
      const valor = body.valor !== null && body.valor !== '' ? Number(body.valor) : null;
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
      updateData.valor = valor;
    }
    if (body.dataDocumento !== undefined) {
      const dataDocumento = body.dataDocumento ? new Date(`${body.dataDocumento}T00:00:00.000Z`) : null;
      if (dataDocumento && Number.isNaN(dataDocumento.getTime())) return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
      updateData.dataDocumento = dataDocumento;
    }
    if (body.cloudStoragePath !== undefined) updateData.cloudStoragePath = body.cloudStoragePath;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.nomeOriginal !== undefined) updateData.nomeOriginal = body.nomeOriginal;
    const data = await prisma.documentoIrs.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const { item, forbidden } = await getOwned(params.id, userId);
    if (forbidden) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (item.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    await prisma.documentoIrs.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
