export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Marca/desmarca um documento como "ignorado" (não é para lançar na app) e guarda uma nota.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const data: { ignorado?: boolean; nota?: string | null } = {};
    if (typeof body.ignorado === 'boolean') data.ignorado = body.ignorado;
    if (typeof body.nota === 'string') data.nota = body.nota.trim() || null;
    const doc = await prisma.eFaturaDocumento.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, documento: doc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
