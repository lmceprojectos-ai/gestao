export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar } from '@/lib/parceiros/acesso';
import { getFileUrl, deleteFile } from '@/lib/s3';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const att = await prisma.parceiroAnexo.findUnique({ where: { id: params.id } });
  if (!att) return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
  const url = await getFileUrl(att.cloudStoragePath, att.contentType ?? 'application/octet-stream', false);
  return NextResponse.json({ url, fileName: att.fileName });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const att = await prisma.parceiroAnexo.findUnique({ where: { id: params.id }, include: { transaction: { select: { company: true } } } });
  if (!att) return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
  if (!podeAlterar(user, att.transaction.company)) return NextResponse.json({ message: 'Sem permissão para eliminar este documento.' }, { status: 403 });
  try { await deleteFile(att.cloudStoragePath); } catch {}
  await prisma.parceiroAnexo.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
