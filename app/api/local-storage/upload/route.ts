export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, writeLocalFile } from '@/lib/local-storage';

// Recebe o ficheiro enviado pelo browser para o URL devolvido por
// generatePresignedUploadUrl (equivalente ao PUT pré-assinado do S3).
export async function PUT(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('key');
  if (!key) return NextResponse.json({ error: 'key em falta.' }, { status: 400 });
  if (!verifySignature('put', key, sp.get('exp'), sp.get('sig'))) {
    return NextResponse.json({ error: 'Link de envio inválido ou expirado.' }, { status: 403 });
  }
  try {
    writeLocalFile(key, Buffer.from(await req.arrayBuffer()));
    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro ao guardar ficheiro.' }, { status: 400 });
  }
}
