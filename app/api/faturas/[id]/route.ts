export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fatura = await prisma.fatura.findUnique({
      where: { id: params?.id },
      include: { cliente: { select: { nome: true } }, fornecedor: { select: { nome: true } }, faturaRelacionada: { select: { id: true, numero: true } }, notasCredito: { select: { id: true, numero: true, valor: true, tipo: true } } },
    });

    if (!fatura) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    const fileUrl = await getFileUrl(fatura.cloudStoragePath, fatura.contentType, fatura.isPublic);
    let versoUrl = null;
    if ((fatura as any).versoPath) {
      versoUrl = await getFileUrl((fatura as any).versoPath, (fatura as any).versoContentType || 'image/jpeg', fatura.isPublic);
    }
    let comprovativoUrl = null;
    if ((fatura as any).comprovativoPath) {
      comprovativoUrl = await getFileUrl((fatura as any).comprovativoPath, (fatura as any).comprovativoContentType || 'application/pdf', fatura.isPublic);
    }

    return NextResponse.json({ ...fatura, fileUrl, versoUrl, comprovativoUrl });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      numero, descricao, tipo, origem, valor, valorBruto, impostos,
      estado, dataEmissao, dataVencimento, clienteId, fornecedorId,
      entidadeNome, entidadeNif, referencia,
    } = body ?? {};

    const updateData: any = {};
    if (numero !== undefined) updateData.numero = numero || null;
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (origem !== undefined) updateData.origem = origem || null;
    if (valor !== undefined) updateData.valor = valor ? Number(valor) : null;
    if (valorBruto !== undefined) updateData.valorBruto = valorBruto ? Number(valorBruto) : null;
    if (impostos !== undefined) updateData.impostos = impostos ? Number(impostos) : null;
    if (estado !== undefined) updateData.estado = estado;
    if (dataEmissao !== undefined) updateData.dataEmissao = dataEmissao ? new Date(dataEmissao) : null;
    if (dataVencimento !== undefined) updateData.dataVencimento = dataVencimento ? new Date(dataVencimento) : null;
    if (clienteId !== undefined) updateData.clienteId = clienteId || null;
    if (fornecedorId !== undefined) updateData.fornecedorId = fornecedorId || null;
    if (entidadeNome !== undefined) updateData.entidadeNome = entidadeNome || null;
    if (entidadeNif !== undefined) updateData.entidadeNif = entidadeNif || null;
    if (referencia !== undefined) updateData.referencia = referencia || null;
    if (body?.categoria !== undefined) updateData.categoria = body.categoria || 'outro';
    if (body?.versoPath !== undefined) updateData.versoPath = body.versoPath || null;
    if (body?.versoContentType !== undefined) updateData.versoContentType = body.versoContentType || null;
    if (body?.versoOriginal !== undefined) updateData.versoOriginal = body.versoOriginal || null;
    if (body?.comprovativoPath !== undefined) updateData.comprovativoPath = body.comprovativoPath || null;
    if (body?.comprovativoContentType !== undefined) updateData.comprovativoContentType = body.comprovativoContentType || null;
    if (body?.comprovativoOriginal !== undefined) updateData.comprovativoOriginal = body.comprovativoOriginal || null;
    if (body?.formaPagamento !== undefined) updateData.formaPagamento = body.formaPagamento || null;
    if (body?.faturaRelacionadaId !== undefined) updateData.faturaRelacionadaId = body.faturaRelacionadaId || null;
    if (body?.dataPagamento !== undefined) updateData.dataPagamento = body.dataPagamento ? new Date(body.dataPagamento) : null;
    if (body?.pagamentoValidado !== undefined) {
      updateData.pagamentoValidado = !!body.pagamentoValidado;
      if (body.pagamentoValidado) {
        updateData.dataValidacaoPagamento = new Date();
        updateData.validadoPor = session?.user?.name || session?.user?.email || null;
      } else {
        updateData.dataValidacaoPagamento = null;
        updateData.validadoPor = null;
      }
    }

    const fatura = await prisma.fatura.update({
      where: { id: params?.id },
      data: updateData,
    });

    return NextResponse.json(fatura);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar fatura' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fatura = await prisma.fatura.findUnique({ where: { id: params?.id } });
    if (!fatura) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    await deleteFile(fatura.cloudStoragePath);
    if ((fatura as any).versoPath) { try { await deleteFile((fatura as any).versoPath); } catch {} }
    if ((fatura as any).comprovativoPath) { try { await deleteFile((fatura as any).comprovativoPath); } catch {} }
    await prisma.fatura.delete({ where: { id: params?.id } });

    return NextResponse.json({ message: 'Fatura eliminada' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
