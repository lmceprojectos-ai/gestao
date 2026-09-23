export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado');
  const pasta = searchParams.get('pasta');

  const where: any = {};
  if (estado) where.estado = estado;
  if (pasta) where.pasta = pasta;

  const [itens, contagens] = await Promise.all([
    prisma.digitalizacaoImportada.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.digitalizacaoImportada.groupBy({
      by: ['estado'],
      _count: { _all: true },
    }),
  ]);

  const resumo: Record<string, number> = {};
  for (const c of contagens) resumo[c.estado] = c._count._all;

  return NextResponse.json({ itens, resumo });
}
