export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { duplicadosFornecedorMoloni, limparDuplicadosFornecedorMoloni } from '@/lib/moloni-fornecedores';

// Documentos de fornecedores que a importação do Moloni criou em duplicado
// (GET: quantos são; POST: apaga-os, passando a ligação ao Moloni para o par na app).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await duplicadosFornecedorMoloni());
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json(await limparDuplicadosFornecedorMoloni());
  } catch (e: any) {
    console.error('Limpar duplicados Moloni:', e);
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
