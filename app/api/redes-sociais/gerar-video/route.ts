export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';

// A criação automática de vídeos (imagens por IA + montagem) está desligada. Os vídeos das publicações são carregados manualmente.
export async function POST() {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  return NextResponse.json(
    { error: 'A criação de vídeos por IA está desligada. Carregue o vídeo manualmente.' },
    { status: 501 },
  );
}
