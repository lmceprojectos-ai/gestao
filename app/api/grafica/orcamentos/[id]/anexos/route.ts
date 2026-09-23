export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// Anexos (ficheiros finais / fotos do trabalho produzido) de um orçamento gráfico.
// Guardados como array JSON no campo `anexos` do OrcamentoGrafico.
// Sem reconhecimento de texto (OCR) — apenas upload, consulta e eliminação.

type Anexo = {
  id: string;
  cloudStoragePath: string;
  contentType: string | null;
  nomeOriginal: string | null;
  descricao: string | null;
  orientacao: string | null; // 'vertical' | 'horizontal'
  tipo: string | null;       // 'ficheiro_final' | 'foto'
  criadoPor: string | null;
  createdAt: string;
};

function gerarId() {
  return `anx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// GET — lista os anexos do orçamento com URLs assinados (para pré-visualização/descarga).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id }, select: { anexos: true } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    const lista: Anexo[] = Array.isArray(orc.anexos) ? (orc.anexos as any) : [];
    const comUrl = await Promise.all(
      lista.map(async (a) => {
        let url: string | null = null;
        try {
          if (a.cloudStoragePath) url = await getFileUrl(a.cloudStoragePath, a.contentType || 'application/octet-stream', false);
        } catch {}
        return { ...a, url };
      })
    );
    return NextResponse.json(comUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — adiciona um novo anexo (metadados) após o upload para o armazenamento.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id }, select: { anexos: true } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    const body = await req.json();
    if (!body.cloudStoragePath) return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 });
    const orientacao = body.orientacao === 'horizontal' ? 'horizontal' : body.orientacao === 'vertical' ? 'vertical' : null;
    const tipo = body.tipo === 'foto' ? 'foto' : 'ficheiro_final';
    const novo: Anexo = {
      id: gerarId(),
      cloudStoragePath: String(body.cloudStoragePath),
      contentType: body.contentType || null,
      nomeOriginal: body.nomeOriginal || null,
      descricao: (body.descricao || '').toString().trim() || null,
      orientacao,
      tipo,
      criadoPor: (session.user as any)?.name || (session.user as any)?.email || null,
      createdAt: new Date().toISOString(),
    };
    const lista: Anexo[] = Array.isArray(orc.anexos) ? (orc.anexos as any) : [];
    const atualizada = [...lista, novo];
    await prisma.orcamentoGrafico.update({ where: { id: params.id }, data: { anexos: atualizada as any } });
    return NextResponse.json(novo, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
