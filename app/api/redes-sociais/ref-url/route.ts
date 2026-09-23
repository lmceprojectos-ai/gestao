import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';
import { getFileUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

// Devolve o URL público de um ficheiro previamente carregado (imagens de exemplo).
export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }
  try {
    const { path, contentType } = await req.json();
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Caminho em falta.' }, { status: 400 });
    }
    const url = await getFileUrl(path, contentType || 'image/jpeg', true);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[redes-sociais/ref-url]', err);
    return NextResponse.json({ error: 'Erro ao obter o URL.' }, { status: 500 });
  }
}
