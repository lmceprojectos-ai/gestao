export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const faturas = await prisma.fatura.findMany({
      orderBy: [{ dataEmissao: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: {
        cliente: { select: { nome: true } },
        fornecedor: { select: { nome: true } },
        faturaRelacionada: { select: { id: true, numero: true } },
      },
    });
    return NextResponse.json(faturas ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { numero, descricao, tipo, origem, valor, dataEmissao, dataVencimento, cloudStoragePath, isPublic, contentType, nomeOriginal, clienteId, fornecedorId, categoria, entidadeNome, entidadeNif, valorBruto, impostos, versoPath, versoContentType, versoOriginal, comprovativoPath, comprovativoContentType, comprovativoOriginal, formaPagamento, faturaRelacionadaId } = body ?? {};
    const tipoFinal = tipo ?? 'recebida';
    const origemFinal = origem || (clienteId ? 'cliente' : fornecedorId ? 'fornecedor' : (tipoFinal === 'emitida' ? 'cliente' : tipoFinal === 'recebida' ? 'fornecedor' : null));

    if (!cloudStoragePath || !nomeOriginal) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 });
    }

    const fatura = await prisma.fatura.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        numero: numero ?? null,
        descricao: descricao ?? null,
        tipo: tipoFinal,
        origem: origemFinal,
        valor: valor ? Number(valor) : null,
        dataEmissao: dataEmissao ? new Date(dataEmissao) : null,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        cloudStoragePath: cloudStoragePath,
        isPublic: isPublic ?? false,
        contentType: contentType ?? 'application/pdf',
        nomeOriginal,
        clienteId: clienteId || null,
        fornecedorId: fornecedorId || null,
        categoria: categoria || 'outro',
        entidadeNome: entidadeNome || null,
        entidadeNif: entidadeNif || null,
        valorBruto: valorBruto ? Number(valorBruto) : null,
        impostos: impostos ? Number(impostos) : null,
        versoPath: versoPath || null,
        versoContentType: versoContentType || null,
        versoOriginal: versoOriginal || null,
        comprovativoPath: comprovativoPath || null,
        comprovativoContentType: comprovativoContentType || null,
        comprovativoOriginal: comprovativoOriginal || null,
        formaPagamento: formaPagamento || null,
        faturaRelacionadaId: faturaRelacionadaId || null,
      },
      include: { cliente: { select: { nome: true } }, fornecedor: { select: { nome: true } }, faturaRelacionada: { select: { id: true, numero: true } } },
    });

    return NextResponse.json(fatura, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar fatura' }, { status: 500 });
  }
}
