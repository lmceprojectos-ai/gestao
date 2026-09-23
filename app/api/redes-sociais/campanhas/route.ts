export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSocialAccess } from '@/lib/social/guard';

export async function GET(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const where: any = {};
    if (estado) where.estado = estado;
    const data = await prisma.socialCampaign.findMany({ where, orderBy: [{ createdAt: 'desc' }] });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    if (!body.nome) return NextResponse.json({ error: 'O nome da campanha é obrigatório' }, { status: 400 });
    const criadoPor = (guard.session.user as any)?.name || (guard.session.user as any)?.email || null;
    const created = await prisma.socialCampaign.create({
      data: {
        nome: body.nome,
        objetivo: body.objetivo || null,
        plataformas: body.plataformas || 'facebook',
        estado: body.estado || 'planeada',
        orcamento: body.orcamento != null ? Number(body.orcamento) : null,
        gastoAtual: body.gastoAtual != null ? Number(body.gastoAtual) : 0,
        inicio: body.inicio ? new Date(body.inicio) : null,
        fim: body.fim ? new Date(body.fim) : null,
        impressoes: body.impressoes != null ? Number(body.impressoes) : 0,
        alcance: body.alcance != null ? Number(body.alcance) : 0,
        cliques: body.cliques != null ? Number(body.cliques) : 0,
        conversoes: body.conversoes != null ? Number(body.conversoes) : 0,
        notas: body.notas || null,
        criadoPor,
      },
    });
    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
