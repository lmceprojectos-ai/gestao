export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { utilizadorParceiros, contaDoPedido } from '@/lib/parceiros/acesso';
import { lerRegisto } from '@/lib/parceiros/registo';
import { enrich, movementOf, typeLabels } from '@/lib/parceiros/calc';
import { getAllDTO } from '@/lib/parceiros/server-tx';
import { notifyChange } from '@/lib/parceiros/notify';
import { formatDatePT } from '@/lib/parceiros/format';

// GET ?conta=<parceiroId>: registos e saldos da conta corrente desse parceiro.
export async function GET(request: Request) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const conta = await contaDoPedido(user, new URL(request.url).searchParams.get('conta'));
  if (!conta) return NextResponse.json({ message: 'Conta não encontrada.' }, { status: 404 });
  try {
    const { rows, totals } = enrich(await getAllDTO(conta.id));
    return NextResponse.json({ rows, totals });
  } catch (e) {
    console.error('Parceiros GET', e);
    return NextResponse.json({ message: 'Erro ao carregar registos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await utilizadorParceiros();
  if (!user) return NextResponse.json({ message: 'Sem acesso aos Parceiros.' }, { status: 401 });
  const conta = await contaDoPedido(user, new URL(request.url).searchParams.get('conta'));
  if (!conta) return NextResponse.json({ message: 'Conta não encontrada.' }, { status: 404 });
  try {
    const lido = lerRegisto(await request.json().catch(() => ({})), user);
    if ('erro' in lido) return NextResponse.json({ message: lido.erro }, { status: lido.status });
    const { date, description, reference, amount, type, paymentDirection, isBilled, notify } = lido;
    const last = await prisma.parceiroTransacao.findFirst({ where: { parceiroId: conta.id }, orderBy: { orderIndex: 'desc' }, select: { orderIndex: true } });
    // O administrador (Criaconsensos) pode registar em nome do parceiro (crédito, ou pagamento do parceiro).
    const company = !user.isAdmin ? 'PARCEIRO'
      : type === 'CREDIT' || (type === 'PAYMENT' && paymentDirection === 'B_PAYS_A') ? 'PARCEIRO' : 'CRIACONSENSOS';
    const created = await prisma.parceiroTransacao.create({
      data: {
        parceiroId: conta.id, date: new Date(`${date}T00:00:00.000Z`), description, reference, amount, type, paymentDirection, isBilled,
        orderIndex: (last?.orderIndex ?? 0) + 1, company, createdById: user.id,
      },
    });
    if (notify) {
      const { totals } = enrich(await getAllDTO(conta.id));
      await notifyChange({
        parceiro: conta, action: 'criado', actor: user.name,
        summary: { date: formatDatePT(date), description, reference, typeLabel: typeLabels(conta.nome)[type], amount: movementOf({ type, amount, paymentDirection }), isBilled },
        totals,
      });
    }
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error('Parceiros POST', e);
    return NextResponse.json({ message: 'Erro ao criar registo.' }, { status: 500 });
  }
}
