export const dynamic = 'force-dynamic';

import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { isPublicKey, resolveLocalPath, verifySignature } from '@/lib/local-storage';

// Serve ficheiros guardados localmente. Ficheiros públicos (".../public/...") são
// abertos por qualquer pessoa; os privados só com um link assinado e válido
// (gerado por getFileUrl depois de a rota que o pede verificar as permissões).
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = params.path.map((p) => decodeURIComponent(p)).join('/');
  const sp = req.nextUrl.searchParams;

  if (!isPublicKey(key) && !verifySignature('get', key, sp.get('exp'), sp.get('sig'))) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 403 });
  }

  let full: string;
  try {
    full = resolveLocalPath(key);
  } catch {
    return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 });
  }
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: 'Ficheiro não encontrado.' }, { status: 404 });
  }

  const contentType = sp.get('ct') || 'application/octet-stream';
  const inline = sp.get('inline') === '1';
  const fileName = (key.split('/').pop() || 'ficheiro').replace(/^\d+-/, '');
  const asciiName = fileName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') || 'ficheiro';
  const data = fs.readFileSync(full);
  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': isPublicKey(key) ? 'public, max-age=86400' : 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
