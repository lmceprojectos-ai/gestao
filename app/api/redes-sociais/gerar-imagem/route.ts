export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';

// A criação de imagens por IA está desligada.
// As imagens das publicações são carregadas manualmente.
export async function POST() {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  return NextResponse.json(
    { error: 'A criação de imagens por IA está desligada. Carregue a imagem manualmente.' },
    { status: 501 },
  );
}
