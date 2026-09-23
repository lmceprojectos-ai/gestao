export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// Documentos de identificação (cartão de cidadão / carta de condução), frente e verso.
// Privado por utilizador — cada utilizador só vê/gere os seus.

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const docs = await prisma.documentoIdentificacao.findMany({ where: { userId } });
    const withUrls = await Promise.all(docs.map(async (d) => {
      let url: string | null = null;
      if (d.cloudStoragePath) {
        try { url = await getFileUrl(d.cloudStoragePath, d.contentType || 'image/jpeg', false); } catch { url = null; }
      }
      return { ...d, url };
    }));
    return NextResponse.json(withUrls);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const TIPOS = ['cartao_cidadao', 'carta_conducao'];
const LADOS = ['frente', 'verso'];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const body = await req.json();
    const tipo = String(body.tipo || '');
    const lado = String(body.lado || '');
    if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    if (!LADOS.includes(lado)) return NextResponse.json({ error: 'Lado inválido' }, { status: 400 });

    const payload = {
      cloudStoragePath: body.cloudStoragePath || null,
      contentType: body.contentType || null,
      nomeOriginal: body.nomeOriginal || null,
    };

    const doc = await prisma.documentoIdentificacao.upsert({
      where: { userId_tipo_lado: { userId, tipo, lado } },
      update: payload,
      create: { userId, tipo, lado, ...payload },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
