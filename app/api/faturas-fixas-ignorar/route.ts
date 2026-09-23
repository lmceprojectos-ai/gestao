export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Registos de faturas fixas detetadas AUTOMATICAMENTE que o utilizador anulou
// por estarem erradas (correspondência automática incorreta).

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const ignoradas = await prisma.faturaFixaIgnorada.findMany({
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
    return NextResponse.json(ignoradas ?? []);
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
    const { tipo, docId, fornecedor, ano, mes } = body ?? {};
    if (!tipo || !docId || !fornecedor) {
      return NextResponse.json({ error: 'Dados em falta' }, { status: 400 });
    }

    const criadoPor = (session.user as any)?.email || null;

    const registo = await prisma.faturaFixaIgnorada.upsert({
      where: { tipo_docId_fornecedor: { tipo: String(tipo), docId: String(docId), fornecedor: String(fornecedor) } },
      update: { ano: Number(ano) || 0, mes: Number(mes) || 0, criadoPor },
      create: {
        tipo: String(tipo),
        docId: String(docId),
        fornecedor: String(fornecedor),
        ano: Number(ano) || 0,
        mes: Number(mes) || 0,
        criadoPor,
      },
    });
    return NextResponse.json(registo);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tipo = searchParams.get('tipo');
    const docId = searchParams.get('docId');
    const fornecedor = searchParams.get('fornecedor');

    if (id) {
      await prisma.faturaFixaIgnorada.delete({ where: { id } });
    } else if (tipo && docId && fornecedor) {
      await prisma.faturaFixaIgnorada.deleteMany({ where: { tipo, docId, fornecedor } });
    } else {
      return NextResponse.json({ error: 'Dados em falta' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
