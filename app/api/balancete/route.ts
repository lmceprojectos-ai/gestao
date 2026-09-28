export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { dashboardBalancete } from '@/lib/balancete';

// Dashboard do balancete: receitas, despesas, resultado, contas, trimestres e categorias.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await dashboardBalancete());
  } catch (e: any) {
    console.error('Balancete dashboard:', e);
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
