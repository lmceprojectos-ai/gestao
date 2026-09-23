export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { classificarCategoria } from '@/lib/categorizacao';

// Reclassifica as faturas de fornecedor que ainda estão sem categoria ou em
// "outro", atribuindo a categoria correta (histórico do fornecedor + IA).
// Não toca em faturas já classificadas manualmente noutra categoria.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const alvo = await prisma.fatura.findMany({
      where: {
        tipo: 'recebida',
        origem: 'fornecedor',
        OR: [{ categoria: null }, { categoria: 'outro' }],
      },
      select: {
        id: true,
        entidadeNif: true,
        entidadeNome: true,
        descricao: true,
        fornecedor: { select: { nif: true, nome: true } },
      },
    });

    let atualizadas = 0;
    const porCategoria: Record<string, number> = {};

    for (const f of alvo) {
      const slug = await classificarCategoria({
        nif: f.entidadeNif || f.fornecedor?.nif,
        nome: f.entidadeNome || f.fornecedor?.nome,
        descricao: f.descricao,
      });
      if (slug && slug !== 'outro') {
        await prisma.fatura.update({ where: { id: f.id }, data: { categoria: slug } });
        atualizadas++;
        porCategoria[slug] = (porCategoria[slug] || 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      analisadas: alvo.length,
      atualizadas,
      porCategoria,
    });
  } catch (e: any) {
    console.error('reclassificar erro:', e?.message);
    return NextResponse.json({ error: e?.message || 'Erro ao reclassificar' }, { status: 500 });
  }
}
