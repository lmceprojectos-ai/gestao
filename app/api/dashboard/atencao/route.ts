export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { calcularAtencao } from '@/lib/dashboard/atencao';

// Painel inicial: a pagar / a receber por data e alertas de tudo o que precisa de ação.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json(await calcularAtencao());
  } catch (error: any) {
    console.error('Dashboard atenção error:', error);
    return NextResponse.json({ error: 'Erro ao carregar os alertas' }, { status: 500 });
  }
}
