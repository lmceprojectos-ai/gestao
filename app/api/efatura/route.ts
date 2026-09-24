export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { estadoMesEFatura, mesesEFatura } from '@/lib/efatura/estado';

// Documentos do e-Fatura de um mês, com o estado de cada um na app.
// GET /api/efatura?mes=AAAA-MM  (sem mês: o mais recente importado)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const meses = await mesesEFatura();
    const mes = req.nextUrl.searchParams.get('mes') || meses[0]?.mes;
    if (!mes) return NextResponse.json({ meses, mes: null, documentos: [], resumo: null });

    const { linhas, resumo } = await estadoMesEFatura(mes);
    return NextResponse.json({ meses, mes, documentos: linhas, resumo });
  } catch (error: any) {
    console.error('efatura GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Apaga todos os documentos importados de um mês (para voltar a importar).
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const mes = req.nextUrl.searchParams.get('mes');
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Indique o mês (AAAA-MM)' }, { status: 400 });
    const r = await prisma.eFaturaDocumento.deleteMany({ where: { mes } });
    return NextResponse.json({ success: true, apagados: r.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
