export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// Devolve um redirecionamento para o URL (assinado) do ficheiro original.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const item = await prisma.digitalizacaoImportada.findUnique({
    where: { id: params.id },
    select: { cloudStoragePath: true, contentType: true, isPublic: true },
  });
  if (!item || !item.cloudStoragePath) {
    return NextResponse.json({ error: 'Ficheiro não disponível' }, { status: 404 });
  }
  // Servir sempre inline para pré-visualizar (evita descarregar o PDF).
  const url = await getFileUrl(
    item.cloudStoragePath,
    item.contentType || 'application/octet-stream',
    item.isPublic,
    true
  );
  return NextResponse.redirect(url);
}
