export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { calcularOrcamento } from '@/lib/grafica';

// Cálculo em tempo real (sem gravar) — para pré-visualização no formulário
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    const config = await carregarConfigGrafica();
    const resultado = calcularOrcamento({
      produto: body.produto || 'cartoes',
      input: body.input || {},
      quantidade: Number(body.quantidade) || 0,
      tipoCliente: body.tipoCliente || 'novo',
      entrega24h: !!body.entrega24h,
      descontoManual: body.descontoManual != null ? Number(body.descontoManual) : null,
      tipoOrcamento: body.tipoOrcamento || 'OC',
      config,
    });
    return NextResponse.json(resultado);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
