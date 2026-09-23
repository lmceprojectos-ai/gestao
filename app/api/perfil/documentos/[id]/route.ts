export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { deleteFile } from '@/lib/s3';

// Elimina um documento de identificação do próprio utilizador.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const item = await prisma.documentoIdentificacao.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (item.userId !== userId) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    if (item.cloudStoragePath) { try { await deleteFile(item.cloudStoragePath); } catch {} }
    await prisma.documentoIdentificacao.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
