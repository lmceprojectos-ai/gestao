export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Nomes dos parceiros, para escolher em Gestão → Utilizadores (administradores e editores).
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== 'admin' && role !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  return NextResponse.json(await prisma.parceiro.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, ativo: true } }));
}
