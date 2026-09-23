export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.seguro.findMany({ orderBy: { createdAt: 'desc' } });
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
    if (!body.tipo) return NextResponse.json({ error: 'Tipo é obrigatório' }, { status: 400 });
    const data = await prisma.seguro.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        tipo: body.tipo,
        descricao: body.descricao || null,
        seguradora: body.seguradora || null,
        apolice: body.apolice || null,
        valor: Number(body.valor) || 0,
        periodicidade: body.periodicidade || null,
        dataInicio: body.dataInicio ? new Date(body.dataInicio) : null,
        dataVencimento: body.dataVencimento ? new Date(body.dataVencimento) : null,
        dataEmissao: body.dataEmissao ? new Date(body.dataEmissao) : null,
        dataPagamento: body.dataPagamento ? new Date(body.dataPagamento) : null,
        estado: body.estado || 'pendente',
        referencia: body.referencia || null,
        notas: body.notas || null,
        entidadeNome: body.entidadeNome || null,
        entidadeNif: body.entidadeNif || null,
        cloudStoragePath: body.cloudStoragePath || null,
        contentType: body.contentType || null,
        nomeOriginal: body.nomeOriginal || null,
        isPublic: body.isPublic || false,
        comprovativoPath: body.comprovativoPath || null,
        comprovativoContentType: body.comprovativoContentType || null,
        comprovativoOriginal: body.comprovativoOriginal || null,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
