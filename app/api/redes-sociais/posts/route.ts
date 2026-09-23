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
    const tipo = searchParams.get('tipo');
    const where: any = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    const data = await prisma.socialPost.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
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
    if (!body.titulo) return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 });
    const criadoPor = (guard.session.user as any)?.name || (guard.session.user as any)?.email || null;
    const created = await prisma.socialPost.create({
      data: {
        titulo: body.titulo,
        plataformas: body.plataformas || 'facebook',
        tipo: body.tipo || 'publicacao',
        formato: body.formato || 'imagem',
        texto: body.texto || null,
        imagemPath: body.imagemPath || null,
        imagemUrl: body.imagemUrl || null,
        imagemContentType: body.imagemContentType || null,
        videoPath: body.videoPath || null,
        videoUrl: body.videoUrl || null,
        videoContentType: body.videoContentType || null,
        roteiro: body.roteiro ?? undefined,
        estado: body.estado || 'rascunho',
        agendadoEm: body.agendadoEm ? new Date(body.agendadoEm) : null,
        promptTexto: body.promptTexto || null,
        promptImagem: body.promptImagem || null,
        referencias: body.referencias ?? undefined,
        conteudoPlataformas: body.conteudoPlataformas ?? undefined,
        briefIa: body.briefIa || null,
        notas: body.notas || null,
        campanhaId: body.campanhaId || null,
        criadoPor,
      },
    });
    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
