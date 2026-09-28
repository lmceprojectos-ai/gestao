export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { relatoriosBalancete } from '@/lib/balancete';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await relatoriosBalancete());
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
