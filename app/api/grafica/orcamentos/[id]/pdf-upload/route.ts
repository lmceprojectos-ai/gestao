export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { uploadBufferToS3, getFileUrl } from '@/lib/s3';
import { formatNumeroOrcamento, anoDe } from '@/lib/grafica/numero';

// Recebe o PDF (base64) já gerado no cliente, carrega-o para storage público
// e devolve um URL permanente e partilhável (usado para enviar o PDF por WhatsApp).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pdfBase64 = String(body?.pdf_base64 || '');
    if (!pdfBase64) return NextResponse.json({ error: 'PDF em falta' }, { status: 400 });

    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    const numeroFmt = formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt as any));
    const nomeBase = [numeroFmt, orc.clienteNome]
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'orcamento';
    const fileName = `${nomeBase}.pdf`;

    const buffer = Buffer.from(pdfBase64, 'base64');
    const { cloud_storage_path } = await uploadBufferToS3(buffer, fileName, 'application/pdf', true);
    const url = await getFileUrl(cloud_storage_path, 'application/pdf', true);

    // Guardar o caminho para que a rota pública /pdf-file possa voltar a servir
    // este PDF (com nome limpo) sem ter de o regenerar.
    await prisma.orcamentoGrafico.update({
      where: { id: params.id },
      data: { pdfPublicPath: cloud_storage_path },
    });

    return NextResponse.json({ url, cloud_storage_path });
  } catch (error: any) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: error?.message || 'Falha ao carregar PDF' }, { status: 500 });
  }
}
