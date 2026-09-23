export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { criarRegisto } from '@/lib/onedrive/records';
import { nomeFicheiroDigitalizacao, renameItem } from '@/lib/onedrive/graph';

// Cria o registo real no módulo a partir dos dados (já revistos) e marca como confirmado.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const item = await prisma.digitalizacaoImportada.findUnique({
    where: { id: params.id },
  });
  if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  if (item.estado === 'confirmado' && item.registoCriadoId) {
    return NextResponse.json({ error: 'Já foi confirmado' }, { status: 400 });
  }

  // Permitir edições finais enviadas no corpo do pedido.
  let dados: any = item.dadosExtraidos;
  try {
    const body = await req.json();
    if (body && body.dadosExtraidos) dados = body.dadosExtraidos;
  } catch {
    /* sem corpo */
  }
  if (!dados) {
    return NextResponse.json({ error: 'Sem dados para criar o registo' }, { status: 400 });
  }

  const criadoPor =
    (session.user as any)?.name || (session.user as any)?.email || 'Utilizador';

  try {
    const registoId = await criarRegisto(
      item.modulo,
      dados,
      {
        cloudStoragePath: item.cloudStoragePath,
        contentType: item.contentType,
        nomeOriginal: item.nomeOriginal,
        isPublic: item.isPublic,
      },
      criadoPor
    );
    // Renomear o ficheiro no OneDrive de acordo com o padrão acordado
    // (Fatura_/Comprovativo_/Despesa_). É best-effort: se a permissão de
    // escrita ainda não estiver concedida, ou faltarem campos, mantém-se o
    // nome original e a confirmação prossegue na mesma.
    let novoNome: string | null = null;
    try {
      const candidato = nomeFicheiroDigitalizacao(item.modulo, dados, item.nomeOriginal);
      if (candidato && candidato !== item.nomeOriginal) {
        await renameItem(item.driveItemId, candidato);
        novoNome = candidato;
      }
    } catch (e: any) {
      console.error('Não foi possível renomear o ficheiro no OneDrive:', e?.message);
    }

    const atualizado = await prisma.digitalizacaoImportada.update({
      where: { id: params.id },
      data: {
        dadosExtraidos: dados,
        estado: 'confirmado',
        registoCriadoId: registoId,
        confirmadoPor: criadoPor,
        confirmadoEm: new Date(),
        erroMsg: null,
        ...(novoNome ? { nomeOriginal: novoNome } : {}),
      },
    });
    return NextResponse.json({ ok: true, registoId, item: atualizado, renomeado: novoNome });
  } catch (e: any) {
    console.error('Erro ao confirmar digitalização:', e?.message);
    return NextResponse.json(
      { error: e?.message || 'Não foi possível criar o registo' },
      { status: 500 }
    );
  }
}
