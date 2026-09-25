export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { painelEntidades } from '@/lib/painel/entidades';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json(await painelEntidades('fornecedores'));
  } catch (error: any) {
    console.error('Painel fornecedores:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
