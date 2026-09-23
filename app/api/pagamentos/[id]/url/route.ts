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

    const pagamento = await prisma.pagamento.findUnique({ where: { id: params?.id } });
    if (!pagamento) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    let reciboUrl: string | null = null;
    let comprovativoUrl: string | null = null;
    if ((pagamento as any).reciboPath) {
      reciboUrl = await getFileUrl((pagamento as any).reciboPath, (pagamento as any).reciboContentType || 'image/jpeg', false);
    }
    if ((pagamento as any).comprovativoPath) {
      comprovativoUrl = await getFileUrl((pagamento as any).comprovativoPath, (pagamento as any).comprovativoContentType || 'image/jpeg', false);
    }
    return NextResponse.json({ reciboUrl, comprovativoUrl });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
