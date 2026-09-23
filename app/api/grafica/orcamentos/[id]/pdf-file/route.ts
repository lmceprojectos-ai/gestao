export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readFileBuffer } from '@/lib/s3';
import { formatNumeroOrcamento, anoDe } from '@/lib/grafica/numero';

// Rota PÚBLICA (sem sessão) — serve o PDF do orçamento a partir do próprio
// domínio da aplicação, com um nome de ficheiro limpo (ex.: "OC n.º 0003-2026 - Diogo Aires.pdf").
// É o link partilhado por WhatsApp/email: o cliente abre e vê logo o orçamento,
// sem o endereço enorme do armazenamento externo.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc || !orc.pdfPublicPath) {
      return new NextResponse('Orçamento não encontrado', { status: 404 });
    }

    let buffer: Buffer;
    try {
      buffer = await readFileBuffer(orc.pdfPublicPath);
    } catch {
      return new NextResponse('PDF indisponível', { status: 404 });
    }

    const numeroFmt = formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt as any));
    const nomeLimpo =
      [numeroFmt, orc.clienteNome]
        .filter(Boolean)
        .join(' - ')
        .replace(/\//g, '-')
        .replace(/[\\:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'orcamento';
    const asciiName =
      (nomeLimpo.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim() || 'orcamento') + '.pdf';
    const utf8Name = encodeURIComponent(nomeLimpo + '.pdf');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('PDF file serve error:', error);
    return new NextResponse('Erro ao obter o PDF', { status: 500 });
  }
}
