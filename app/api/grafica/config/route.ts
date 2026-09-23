export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { configGraficaDefault } from '@/lib/grafica/config-default';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const config = await carregarConfigGrafica();
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    // merge com o default para garantir integridade dos campos
    const dados = { ...configGraficaDefault, ...body };
    const registo = await prisma.configuracaoGrafica.upsert({
      where: { chave: 'default' },
      update: { dados: dados as any },
      create: { chave: 'default', dados: dados as any },
    });
    return NextResponse.json(registo.dados);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  // repor valores por defeito
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const registo = await prisma.configuracaoGrafica.upsert({
      where: { chave: 'default' },
      update: { dados: configGraficaDefault as any },
      create: { chave: 'default', dados: configGraficaDefault as any },
    });
    return NextResponse.json(registo.dados);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
