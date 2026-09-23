export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { nomeFicheiroDigitalizacao, renameItem } from '@/lib/onedrive/graph';

// Renomeia, no OneDrive, os ficheiros das digitalizações JÁ confirmadas para o
// padrão acordado (Fatura_/Comprovativo_/Despesa_). Operação única sobre os
// ficheiros antigos (os novos já são renomeados ao confirmar).
//
// É processado em lotes com orçamento de tempo, para nunca exceder os limites
// de tempo de resposta em produção. O cliente volta a chamar enquanto
// `maisPorProcessar` for verdadeiro. É idempotente: depois de renomear, o novo
// nome passa a ser o nome atual e o ficheiro deixa de ser considerado.
const MAX_POR_EXECUCAO = 15;
const TEMPO_MAX_MS = 15000;

export async function POST(_req: NextRequest) {
  const inicio = Date.now();
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const resumo = { processados: 0, renomeados: 0, semDados: 0, erros: 0 };

  try {
    // Candidatos: confirmados cujo nome atual difere do nome-alvo.
    const confirmados = await prisma.digitalizacaoImportada.findMany({
      where: { estado: 'confirmado' },
      select: {
        id: true,
        driveItemId: true,
        modulo: true,
        nomeOriginal: true,
        dadosExtraidos: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let maisPorProcessar = false;
    for (const it of confirmados) {
      if (resumo.processados >= MAX_POR_EXECUCAO || Date.now() - inicio > TEMPO_MAX_MS) {
        maisPorProcessar = true;
        break;
      }
      const novo = nomeFicheiroDigitalizacao(it.modulo, it.dadosExtraidos, it.nomeOriginal);
      if (!novo) {
        // Sem dados-chave para gerar nome — mantém-se o original (não conta como trabalho).
        continue;
      }
      if (novo === it.nomeOriginal) {
        // Já está no formato pretendido.
        continue;
      }
      resumo.processados++;
      try {
        await renameItem(it.driveItemId, novo);
        await prisma.digitalizacaoImportada.update({
          where: { id: it.id },
          data: { nomeOriginal: novo },
        });
        resumo.renomeados++;
      } catch (e: any) {
        console.error(`Falha a renomear ${it.nomeOriginal}:`, e?.message);
        resumo.erros++;
      }
    }

    return NextResponse.json({ ...resumo, maisPorProcessar });
  } catch (e: any) {
    console.error('Renomeação em lote falhou:', e?.message);
    return NextResponse.json(
      { error: e?.message || 'Falha na renomeação', ...resumo },
      { status: 500 }
    );
  }
}
