export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros } from '@/lib/parceiros/acesso';
import { DADOS_INICIAIS } from '@/lib/parceiros/dados-iniciais';

// Traz os dados da app CONTA_CORRENTE (Abacus). Só administradores.
//  - sem corpo: os 32 registos do seed original;
//  - { rows: [...] }: a resposta de /api/transactions da app da Abacus (estado atual,
//    com as reconciliações). Os documentos anexos não vêm (ficam na Abacus).
// Não duplica: registos com o mesmo id já existentes são ignorados.
export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user?.isAdmin) return NextResponse.json({ message: 'Só administradores.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const rows: any[] | null = Array.isArray(body?.rows) ? body.rows : null;

  const existentes = new Set((await prisma.parceiroTransacao.findMany({ select: { id: true } })).map((t) => t.id));
  let criados = 0;
  let ligacoes = 0;
  let anexosNaoTrazidos = 0;

  if (!rows) {
    for (const t of DADOS_INICIAIS) {
      const id = `seed-${t.n}`;
      if (existentes.has(id)) continue;
      await prisma.parceiroTransacao.create({
        data: {
          id, date: new Date(`${t.date}T00:00:00.000Z`), description: t.description, reference: t.reference,
          amount: t.amount, type: t.type, paymentDirection: t.paymentDirection, isBilled: t.isBilled,
          orderIndex: t.n, company: t.owner === 'A' ? 'CRIACONSENSOS' : 'RECLAMARTE', createdById: null,
        },
      });
      criados++;
    }
    return NextResponse.json({ criados, ligacoes, anexosNaoTrazidos });
  }

  for (const r of rows) {
    if (!r?.id || existentes.has(r.id)) continue;
    const company = r.createdByCompany === 'RECLAMARTE' ? 'RECLAMARTE' : 'CRIACONSENSOS';
    await prisma.parceiroTransacao.create({
      data: {
        id: String(r.id), date: new Date(`${String(r.date).slice(0, 10)}T00:00:00.000Z`),
        description: String(r.description ?? ''), reference: r.reference ?? null,
        amount: Number(r.amount ?? 0), type: String(r.type), paymentDirection: r.paymentDirection ?? null,
        isBilled: Boolean(r.isBilled), orderIndex: Number(r.orderIndex ?? 0), company, createdById: null,
      },
    });
    existentes.add(r.id);
    criados++;
    anexosNaoTrazidos += Array.isArray(r.attachments) ? r.attachments.length : 0;
  }
  // Reconciliações: cada ligação aparece do lado do pagamento (otherType = trabalho).
  for (const r of rows) {
    if (r?.type !== 'PAYMENT' || !Array.isArray(r.links)) continue;
    for (const l of r.links) {
      if (!existentes.has(l.otherId)) continue;
      const ja = await prisma.parceiroAlocacao.findUnique({ where: { paymentId_workId: { paymentId: r.id, workId: l.otherId } } });
      if (ja) continue;
      await prisma.parceiroAlocacao.create({ data: { id: l.allocationId, paymentId: r.id, workId: l.otherId, amount: Number(l.amount ?? 0), createdById: null } });
      ligacoes++;
    }
  }
  return NextResponse.json({ criados, ligacoes, anexosNaoTrazidos });
}
