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
    const item = await prisma.seguro.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, item.contentType || 'application/pdf', item.isPublic);
    }
    let comprovativoUrl = null;
    if (item.comprovativoPath) {
      comprovativoUrl = await getFileUrl(item.comprovativoPath, item.comprovativoContentType || 'application/pdf', false);
    }
    return NextResponse.json({ ...item, url, comprovativoUrl });
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
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.descricao !== undefined) updateData.descricao = body.descricao || null;
    if (body.seguradora !== undefined) updateData.seguradora = body.seguradora || null;
    if (body.apolice !== undefined) updateData.apolice = body.apolice || null;
    if (body.valor !== undefined) updateData.valor = Number(body.valor) || 0;
    if (body.periodicidade !== undefined) updateData.periodicidade = body.periodicidade || null;
    if (body.dataInicio !== undefined) updateData.dataInicio = body.dataInicio ? new Date(body.dataInicio) : null;
    if (body.dataVencimento !== undefined) updateData.dataVencimento = body.dataVencimento ? new Date(body.dataVencimento) : null;
    if (body.dataEmissao !== undefined) updateData.dataEmissao = body.dataEmissao ? new Date(body.dataEmissao) : null;
    if (body.dataPagamento !== undefined) updateData.dataPagamento = body.dataPagamento ? new Date(body.dataPagamento) : null;
    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.referencia !== undefined) updateData.referencia = body.referencia || null;
    if (body.notas !== undefined) updateData.notas = body.notas || null;
    if (body.entidadeNome !== undefined) updateData.entidadeNome = body.entidadeNome;
    if (body.entidadeNif !== undefined) updateData.entidadeNif = body.entidadeNif;
    if (body.cloudStoragePath !== undefined) updateData.cloudStoragePath = body.cloudStoragePath;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.nomeOriginal !== undefined) updateData.nomeOriginal = body.nomeOriginal;
    if (body.comprovativoPath !== undefined) updateData.comprovativoPath = body.comprovativoPath;
    if (body.comprovativoContentType !== undefined) updateData.comprovativoContentType = body.comprovativoContentType;
    if (body.comprovativoOriginal !== undefined) updateData.comprovativoOriginal = body.comprovativoOriginal;
    const data = await prisma.seguro.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.seguro.findUnique({ where: { id: params.id } });
    if (item?.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    if (item?.comprovativoPath) { try { await deleteFile(item.comprovativoPath); } catch {} }
    await prisma.seguro.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
