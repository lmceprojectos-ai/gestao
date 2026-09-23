export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Privacidade estrita: cada utilizador vê APENAS os seus próprios documentos.
// Nem o admin pode ver os documentos dos outros.

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const data = await prisma.documentoIrs.findMany({
      where: { userId },
      orderBy: [{ ano: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const body = await req.json();
    const ano = parseInt(body.ano, 10);
    if (!ano || Number.isNaN(ano)) return NextResponse.json({ error: 'Ano é obrigatório' }, { status: 400 });
    const valor = body.valor !== undefined && body.valor !== null && body.valor !== '' ? Number(body.valor) : null;
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
    const dataDocumento = body.dataDocumento ? new Date(`${body.dataDocumento}T00:00:00.000Z`) : null;
    if (dataDocumento && Number.isNaN(dataDocumento.getTime())) return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
    const data = await prisma.documentoIrs.create({
      data: {
        userId,
        criadoPor: (session.user as any)?.name || (session.user as any)?.email || null,
        ano,
        descricao: body.descricao || null,
        categoria: body.categoria || null,
        entidadeNome: body.entidadeNome?.trim() || null,
        valor,
        dataDocumento,
        cloudStoragePath: body.cloudStoragePath || null,
        contentType: body.contentType || null,
        nomeOriginal: body.nomeOriginal || null,
        isPublic: false,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
