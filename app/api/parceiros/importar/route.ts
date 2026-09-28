export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, contaDoPedido } from '@/lib/parceiros/acesso';
import { DADOS_INICIAIS } from '@/lib/parceiros/dados-iniciais';

// Traz os 32 registos da app CONTA_CORRENTE (Abacus) para a conta indicada
// (?conta=, a da Reclamarte). Só administradores. Não duplica.
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  const conta = await contaDoPedido(user, new URL(request.url).searchParams.get('conta'));
  if (!conta) return NextResponse.json({ message: 'Conta não encontrada.' }, { status: 404 });
  const existentes = new Set((await prisma.parceiroTransacao.findMany({ select: { id: true } })).map((t) => t.id));
  let criados = 0;
  for (const t of DADOS_INICIAIS) {
    const id = `seed-${t.n}`;
    if (existentes.has(id)) continue;
    await prisma.parceiroTransacao.create({
      data: {
        id, parceiroId: conta.id, date: new Date(`${t.date}T00:00:00.000Z`), description: t.description, reference: t.reference,
        amount: t.amount, type: t.type, paymentDirection: t.paymentDirection, isBilled: t.isBilled,
        orderIndex: t.n, company: t.owner === 'A' ? 'CRIACONSENSOS' : 'PARCEIRO', createdById: null,
      },
    });
    criados++;
  }
  return NextResponse.json({ criados });
}
