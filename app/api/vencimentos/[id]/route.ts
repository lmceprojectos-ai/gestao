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
    const item = await prisma.vencimento.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    let comprovanteUrl = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, item.contentType || 'application/pdf', item.isPublic);
    }
    if ((item as any).comprovanteStoragePath) {
      comprovanteUrl = await getFileUrl((item as any).comprovanteStoragePath, (item as any).comprovanteContentType || 'image/jpeg', item.isPublic);
    }
    return NextResponse.json({ ...item, url, comprovanteUrl });
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
    if (body.funcionario !== undefined) updateData.funcionario = body.funcionario;
    if (body.cargo !== undefined) updateData.cargo = body.cargo || null;
    if (body.valorBruto !== undefined) updateData.valorBruto = Number(body.valorBruto) || 0;
    if (body.valorLiquido !== undefined) updateData.valorLiquido = body.valorLiquido ? Number(body.valorLiquido) : null;
    if (body.segSocial !== undefined) updateData.segSocial = body.segSocial ? Number(body.segSocial) : null;
    if (body.irs !== undefined) updateData.irs = body.irs ? Number(body.irs) : null;
    if (body.outrosDescontos !== undefined) updateData.outrosDescontos = body.outrosDescontos ? Number(body.outrosDescontos) : null;
    if (body.periodo !== undefined) updateData.periodo = body.periodo || null;
    if (body.dataPagamento !== undefined) updateData.dataPagamento = body.dataPagamento ? new Date(body.dataPagamento) : null;
    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.notas !== undefined) updateData.notas = body.notas || null;
    if (body.cloudStoragePath !== undefined) updateData.cloudStoragePath = body.cloudStoragePath;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.nomeOriginal !== undefined) updateData.nomeOriginal = body.nomeOriginal;
    if (body.comprovanteStoragePath !== undefined) updateData.comprovanteStoragePath = body.comprovanteStoragePath;
    if (body.comprovanteContentType !== undefined) updateData.comprovanteContentType = body.comprovanteContentType;
    if (body.comprovanteNomeOriginal !== undefined) updateData.comprovanteNomeOriginal = body.comprovanteNomeOriginal;
    const data = await prisma.vencimento.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.vencimento.findUnique({ where: { id: params.id } });
    if (item?.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    if ((item as any)?.comprovanteStoragePath) { try { await deleteFile((item as any).comprovanteStoragePath); } catch {} }
    await prisma.vencimento.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
