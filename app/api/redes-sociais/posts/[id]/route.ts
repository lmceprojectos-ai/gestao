export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSocialAccess } from '@/lib/social/guard';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const item = await prisma.socialPost.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const data: any = {};
    if (body.titulo !== undefined) data.titulo = body.titulo;
    if (body.plataformas !== undefined) data.plataformas = body.plataformas;
    if (body.tipo !== undefined) data.tipo = body.tipo;
    if (body.formato !== undefined) data.formato = body.formato;
    if (body.texto !== undefined) data.texto = body.texto;
    if (body.imagemPath !== undefined) data.imagemPath = body.imagemPath;
    if (body.imagemUrl !== undefined) data.imagemUrl = body.imagemUrl;
    if (body.imagemContentType !== undefined) data.imagemContentType = body.imagemContentType;
    if (body.videoPath !== undefined) data.videoPath = body.videoPath;
    if (body.videoUrl !== undefined) data.videoUrl = body.videoUrl;
    if (body.videoContentType !== undefined) data.videoContentType = body.videoContentType;
    if (body.roteiro !== undefined) data.roteiro = body.roteiro ?? undefined;
    if (body.campanhaId !== undefined) data.campanhaId = body.campanhaId;
    if (body.estado !== undefined) data.estado = body.estado;
    if (body.agendadoEm !== undefined) data.agendadoEm = body.agendadoEm ? new Date(body.agendadoEm) : null;
    if (body.publicadoEm !== undefined) data.publicadoEm = body.publicadoEm ? new Date(body.publicadoEm) : null;
    if (body.promptTexto !== undefined) data.promptTexto = body.promptTexto;
    if (body.promptImagem !== undefined) data.promptImagem = body.promptImagem;
    if (body.referencias !== undefined) data.referencias = body.referencias ?? undefined;
    if (body.conteudoPlataformas !== undefined) data.conteudoPlataformas = body.conteudoPlataformas ?? undefined;
    if (body.briefIa !== undefined) data.briefIa = body.briefIa;
    if (body.notas !== undefined) data.notas = body.notas;
    const updated = await prisma.socialPost.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    await prisma.socialPost.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
