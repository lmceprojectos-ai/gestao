export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';

function inferContentType(path: string, stored: string | null): string {
  if (stored) return stored;
  const ext = (path.toLowerCase().split('.').pop() || '').split('?')[0];
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };
  return map[ext] || 'application/octet-stream';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.despesa.findUnique({ where: { id: params.id }, include: { fornecedor: { select: { nome: true } } } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, inferContentType(item.cloudStoragePath, item.contentType), item.isPublic);
    }
    let comprovativoUrl = null;
    if (item.comprovativoPath) {
      comprovativoUrl = await getFileUrl(item.comprovativoPath, inferContentType(item.comprovativoPath, item.comprovativoContentType), item.isPublic);
    }
    // Lista de comprovativos (suporta vários; ex.: pagamento misto). Retrocompatível
    // com o comprovativo único antigo.
    const comprovativos: { url: string; nome: string; contentType: string | null }[] = [];
    const extra = Array.isArray((item as any).comprovativosExtra) ? (item as any).comprovativosExtra as any[] : [];
    if (extra.length > 0) {
      for (const c of extra) {
        if (!c?.path) continue;
        const u = await getFileUrl(c.path, inferContentType(c.path, c.contentType || null), item.isPublic);
        comprovativos.push({ url: u, nome: c.nomeOriginal || 'Comprovativo', contentType: c.contentType || null });
      }
    } else if (item.comprovativoPath && comprovativoUrl) {
      comprovativos.push({ url: comprovativoUrl, nome: item.comprovativoNomeOriginal || 'Comprovativo', contentType: item.comprovativoContentType || null });
    }
    return NextResponse.json({ ...item, url, comprovativoUrl, comprovativos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    const old = await prisma.despesa.findUnique({ where: { id: params.id } });
    if (!old) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const updateData: any = {};
    if (body.descricao !== undefined) updateData.descricao = body.descricao;
    if (body.categoria !== undefined) updateData.categoria = body.categoria || null;
    if (body.subcategoria !== undefined) updateData.subcategoria = body.subcategoria || null;
    if (body.valor !== undefined) updateData.valor = Number(body.valor) || 0;
    if (body.data !== undefined) updateData.data = new Date(body.data);
    if (body.estado !== undefined) updateData.estado = body.estado;
    if (body.fornecedorId !== undefined) updateData.fornecedorId = body.fornecedorId || null;
    if (body.seguroId !== undefined) updateData.seguroId = body.seguroId || null;
    if (body.entidadeNome !== undefined) updateData.entidadeNome = body.entidadeNome;
    if (body.entidadeNif !== undefined) updateData.entidadeNif = body.entidadeNif;
    if (body.metodoPagamento !== undefined) updateData.metodoPagamento = body.metodoPagamento || null;
    if (body.contaBancariaId !== undefined) updateData.contaBancariaId = body.contaBancariaId || null;
    if (body.notas !== undefined) updateData.notas = body.notas || null;
    if (body.cloudStoragePath !== undefined) updateData.cloudStoragePath = body.cloudStoragePath;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.nomeOriginal !== undefined) updateData.nomeOriginal = body.nomeOriginal;
    if (body.comprovativoPath !== undefined) updateData.comprovativoPath = body.comprovativoPath;
    if (body.comprovativoContentType !== undefined) updateData.comprovativoContentType = body.comprovativoContentType;
    if (body.comprovativoNomeOriginal !== undefined) updateData.comprovativoNomeOriginal = body.comprovativoNomeOriginal;

    // Valores efetivos após a atualização (o body pode ser parcial)
    const novoEstado = body.estado !== undefined ? body.estado : old.estado;
    const novoValor = body.valor !== undefined ? (Number(body.valor) || 0) : old.valor;
    const novaConta = body.contaBancariaId !== undefined ? (body.contaBancariaId || null) : old.contaBancariaId;

    const data = await prisma.$transaction(async (tx) => {
      const upd = await tx.despesa.update({ where: { id: params.id }, data: updateData });
      // Reverter o efeito antigo no saldo (despesa paga por banco reduz o saldo)
      if (old.estado === 'pago' && old.contaBancariaId) {
        await tx.contaBancaria.update({ where: { id: old.contaBancariaId }, data: { saldoAtual: { increment: Number(old.valor) } } });
      }
      // Aplicar o novo efeito no saldo
      if (novoEstado === 'pago' && novaConta) {
        await tx.contaBancaria.update({ where: { id: novaConta }, data: { saldoAtual: { decrement: Number(novoValor) } } });
      }
      return upd;
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.despesa.findUnique({ where: { id: params.id } });
    if (item?.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    await prisma.$transaction(async (tx) => {
      // Reverter o efeito no saldo se estava paga por banco
      if (item?.estado === 'pago' && item?.contaBancariaId) {
        await tx.contaBancaria.update({ where: { id: item.contaBancariaId }, data: { saldoAtual: { increment: Number(item.valor) } } });
      }
      await tx.despesa.delete({ where: { id: params.id } });
    });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
