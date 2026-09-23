export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';

type Anexo = {
  id: string;
  cloudStoragePath: string;
  contentType: string | null;
  nomeOriginal: string | null;
  descricao: string | null;
  orientacao: string | null;
  tipo: string | null;
  criadoPor: string | null;
  createdAt: string;
};

// GET — URL assinado de um anexo (para descarga direta).
export async function GET(_req: NextRequest, { params }: { params: { id: string; anexoId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id }, select: { anexos: true } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    const lista: Anexo[] = Array.isArray(orc.anexos) ? (orc.anexos as any) : [];
    const anexo = lista.find((a) => a.id === params.anexoId);
    if (!anexo || !anexo.cloudStoragePath) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    const url = await getFileUrl(anexo.cloudStoragePath, anexo.contentType || 'application/octet-stream', false);
    return NextResponse.json({ url, nome: anexo.nomeOriginal || 'ficheiro' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — elimina um anexo (remove do armazenamento e da lista).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; anexoId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id }, select: { anexos: true } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    const lista: Anexo[] = Array.isArray(orc.anexos) ? (orc.anexos as any) : [];
    const anexo = lista.find((a) => a.id === params.anexoId);
    if (!anexo) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    if (anexo.cloudStoragePath) { try { await deleteFile(anexo.cloudStoragePath); } catch {} }
    const atualizada = lista.filter((a) => a.id !== params.anexoId);
    await prisma.orcamentoGrafico.update({ where: { id: params.id }, data: { anexos: atualizada as any } });
    return NextResponse.json({ message: 'Anexo eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
