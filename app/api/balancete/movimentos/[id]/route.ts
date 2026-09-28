export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Classificar um movimento: categoria, subcategoria, método, fiscal e nota.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) ?? {};
  const data: Record<string, string | null> = {};
  for (const k of ['categoria', 'subcategoria', 'metodo', 'fiscal', 'nota'] as const) {
    if (k in body) data[k] = typeof body[k] === 'string' && body[k].trim() ? body[k].trim() : null;
  }
  try {
    const m = await prisma.balanceteMovimento.update({ where: { id: params.id }, data });
    return NextResponse.json(m);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
