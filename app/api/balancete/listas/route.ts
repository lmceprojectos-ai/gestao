export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Categorias, subcategorias, métodos e contas (para os filtros e a edição).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const [listas, contas] = await Promise.all([
    prisma.balanceteLista.findMany({ orderBy: { nome: 'asc' } }),
    prisma.balanceteConta.findMany({ orderBy: { nome: 'asc' }, select: { nome: true } }),
  ]);
  const de = (g: string) => listas.filter((l) => l.grupo === g).map((l) => l.nome);
  return NextResponse.json({ categorias: de('categoria'), subcategorias: de('subcategoria'), metodos: de('metodo'), contas: contas.map((c) => c.nome) });
}
