export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// Devolve um URL assinado para descarregar o ficheiro de arte-final do cliente.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    if (!orc.arteFinalFicheiro) return NextResponse.json({ error: 'Sem ficheiro anexado' }, { status: 404 });

    const url = await getFileUrl(orc.arteFinalFicheiro, 'application/octet-stream', false);
    return NextResponse.json({ url, nome: orc.arteFinalNome || 'ficheiro-cliente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
