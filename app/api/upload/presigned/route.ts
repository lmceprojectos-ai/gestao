export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generatePresignedUploadUrl } from '@/lib/s3';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { fileName, contentType, isPublic } = body ?? {};

    if (!fileName) {
      return NextResponse.json({ error: 'fileName é obrigatório' }, { status: 400 });
    }

    const result = await generatePresignedUploadUrl(
      fileName,
      contentType ?? 'application/octet-stream',
      isPublic ?? false
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao gerar URL' }, { status: 500 });
  }
}
