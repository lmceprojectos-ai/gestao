export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, podeAlterar } from '@/lib/parceiros/acesso';
import { generatePresignedUploadUrl } from '@/lib/s3';

// Endereço assinado para enviar um documento (fica privado, na pasta uploads/).
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const fileName = String(body?.fileName ?? '').trim();
  if (!fileName) return NextResponse.json({ message: 'Nome do ficheiro em falta.' }, { status: 400 });
  const r = await generatePresignedUploadUrl(`parceiros-${fileName}`, body?.contentType ?? 'application/octet-stream', false);
  return NextResponse.json(r);
}
