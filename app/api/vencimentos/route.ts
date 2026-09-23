export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.vencimento.findMany({ orderBy: { createdAt: 'desc' } });
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
    if (!body.funcionario) return NextResponse.json({ error: 'Funcionário é obrigatório' }, { status: 400 });
    const data = await prisma.vencimento.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        funcionario: body.funcionario,
        cargo: body.cargo || null,
        valorBruto: Number(body.valorBruto) || 0,
        valorLiquido: body.valorLiquido ? Number(body.valorLiquido) : null,
        segSocial: body.segSocial ? Number(body.segSocial) : null,
        irs: body.irs ? Number(body.irs) : null,
        outrosDescontos: body.outrosDescontos ? Number(body.outrosDescontos) : null,
        periodo: body.periodo || null,
        dataPagamento: body.dataPagamento ? new Date(body.dataPagamento) : null,
        estado: body.estado || 'pendente',
        notas: body.notas || null,
        cloudStoragePath: body.cloudStoragePath || null,
        contentType: body.contentType || null,
        nomeOriginal: body.nomeOriginal || null,
        comprovanteStoragePath: body.comprovanteStoragePath || null,
        comprovanteContentType: body.comprovanteContentType || null,
        comprovanteNomeOriginal: body.comprovanteNomeOriginal || null,
        isPublic: body.isPublic || false,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
