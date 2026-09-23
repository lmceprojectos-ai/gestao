export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSocialAccess } from '@/lib/social/guard';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const data: any = {};
    if (body.nome !== undefined) data.nome = body.nome;
    if (body.objetivo !== undefined) data.objetivo = body.objetivo;
    if (body.plataformas !== undefined) data.plataformas = body.plataformas;
    if (body.estado !== undefined) data.estado = body.estado;
    if (body.orcamento !== undefined) data.orcamento = body.orcamento != null ? Number(body.orcamento) : null;
    if (body.gastoAtual !== undefined) data.gastoAtual = body.gastoAtual != null ? Number(body.gastoAtual) : null;
    if (body.inicio !== undefined) data.inicio = body.inicio ? new Date(body.inicio) : null;
    if (body.fim !== undefined) data.fim = body.fim ? new Date(body.fim) : null;
    if (body.impressoes !== undefined) data.impressoes = body.impressoes != null ? Number(body.impressoes) : null;
    if (body.alcance !== undefined) data.alcance = body.alcance != null ? Number(body.alcance) : null;
    if (body.cliques !== undefined) data.cliques = body.cliques != null ? Number(body.cliques) : null;
    if (body.conversoes !== undefined) data.conversoes = body.conversoes != null ? Number(body.conversoes) : null;
    if (body.notas !== undefined) data.notas = body.notas;
    const updated = await prisma.socialCampaign.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    await prisma.socialCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
