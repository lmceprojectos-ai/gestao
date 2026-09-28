// Leitura e validação dos dados de um registo (criar/editar), com as regras de
// quem pode registar o quê: débitos só a Criaconsensos, créditos só o parceiro.
import type { TransactionType, PaymentDirection } from '@/lib/parceiros/calc';
import type { UtilizadorParceiros } from '@/lib/parceiros/acesso';

const round2 = (n: number) => Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;

export function lerRegisto(body: any, user: UtilizadorParceiros) {
  const description = String(body?.description ?? '').trim();
  const reference = body?.reference ? String(body.reference).trim() : null;
  const date = String(body?.date ?? '').slice(0, 10);
  const type = String(body?.type ?? '') as TransactionType;
  const amount = Math.max(0, round2(Number(body?.amount ?? 0)));
  const isBilled = Boolean(body?.isBilled);
  const notify = body?.notify !== false;
  const paymentDirection: PaymentDirection | null = type === 'PAYMENT' ? ((body?.paymentDirection as PaymentDirection) === 'B_PAYS_A' ? 'B_PAYS_A' : 'A_PAYS_B') : null;
  if (!description || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['DEBIT', 'CREDIT', 'PAYMENT'].includes(type)) {
    return { erro: 'Dados inválidos.', status: 400 } as const;
  }
  if (!user.isAdmin && type === 'DEBIT') return { erro: 'Apenas a Criaconsensos pode registar débitos.', status: 403 } as const;
  return { description, reference, date, type, amount, isBilled, notify, paymentDirection };
}
