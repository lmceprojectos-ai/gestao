export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Quando ?inline=1, os URLs são servidos para visualização no navegador
    // (Content-Disposition: inline) em vez de forçarem o descarregamento.
    const inline = req.nextUrl.searchParams.get('inline') === '1';

    const fatura = await prisma.fatura.findUnique({ where: { id: params?.id } });
    if (!fatura) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    const url = await getFileUrl(fatura.cloudStoragePath, fatura.contentType, fatura.isPublic, inline);
    let versoUrl = null;
    if ((fatura as any).versoPath) {
      versoUrl = await getFileUrl((fatura as any).versoPath, (fatura as any).versoContentType || 'image/jpeg', fatura.isPublic, inline);
    }
    let comprovativoUrl = null;
    if ((fatura as any).comprovativoPath) {
      comprovativoUrl = await getFileUrl((fatura as any).comprovativoPath, (fatura as any).comprovativoContentType || 'application/pdf', fatura.isPublic, inline);
    }
    return NextResponse.json({ url, versoUrl, comprovativoUrl });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
