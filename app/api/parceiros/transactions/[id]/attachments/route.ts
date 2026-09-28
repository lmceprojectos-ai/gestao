export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar, acessoConta } from '@/lib/parceiros/acesso';

// Guarda um documento (fatura, recibo…) já enviado para o armazenamento.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  try {
    const tx = await prisma.parceiroTransacao.findUnique({ where: { id: params.id } });
    if (!tx || !acessoConta(user, tx.parceiroId)) return NextResponse.json({ message: 'Registo não encontrado.' }, { status: 404 });
    if (!podeAlterar(user, tx)) return NextResponse.json({ message: 'Só pode anexar documentos aos registos da sua empresa.' }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const fileName = String(body?.fileName ?? '').trim();
    const cloudStoragePath = String(body?.cloud_storage_path ?? '').trim();
    if (!fileName || !cloudStoragePath || !cloudStoragePath.includes('uploads/')) return NextResponse.json({ message: 'Dados do ficheiro inválidos.' }, { status: 400 });
    const fileSize = body?.fileSize != null ? Number(body.fileSize) : null;
    const created = await prisma.parceiroAnexo.create({
      data: {
        transactionId: tx.id, fileName, cloudStoragePath, isPublic: false,
        fileSize: Number.isFinite(fileSize as number) ? (fileSize as number) : null,
        contentType: body?.contentType ? String(body.contentType) : null, createdById: user.id,
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error('Parceiros anexo', e);
    return NextResponse.json({ message: 'Erro ao guardar o documento.' }, { status: 500 });
  }
}
