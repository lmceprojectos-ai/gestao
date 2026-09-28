// Registos da conta corrente no formato usado pelo ecrã (igual à app original).
import { prisma } from '@/lib/db';
import type { TransactionDTO, TransactionType, AllocationLinkDTO } from '@/lib/parceiros/calc';

export function toDateStr(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export async function getAllDTO(): Promise<TransactionDTO[]> {
  const txs = await prisma.parceiroTransacao.findMany({
    orderBy: { orderIndex: 'asc' },
    include: {
      createdBy: { select: { name: true } },
      attachments: { orderBy: { createdAt: 'asc' } },
      allocationsAsPayment: { include: { work: { select: { id: true, date: true, description: true, reference: true, type: true } } } },
      allocationsAsWork: { include: { payment: { select: { id: true, date: true, description: true, reference: true, type: true } } } },
    },
  });

  return txs.map((t) => {
    const asPayment: AllocationLinkDTO[] = t.allocationsAsPayment.map((a) => ({
      allocationId: a.id,
      otherId: a.work.id,
      otherDate: toDateStr(a.work.date),
      otherDescription: a.work.description,
      otherReference: a.work.reference ?? null,
      otherType: a.work.type as TransactionType,
      amount: Number(a.amount ?? 0),
    }));
    const asWork: AllocationLinkDTO[] = t.allocationsAsWork.map((a) => ({
      allocationId: a.id,
      otherId: a.payment.id,
      otherDate: toDateStr(a.payment.date),
      otherDescription: a.payment.description,
      otherReference: a.payment.reference ?? null,
      otherType: a.payment.type as TransactionType,
      amount: Number(a.amount ?? 0),
    }));
    const links = [...asPayment, ...asWork];
    return {
      id: t.id,
      date: toDateStr(t.date),
      description: t.description,
      reference: t.reference ?? null,
      amount: Number(t.amount ?? 0),
      type: t.type as any,
      paymentDirection: (t.paymentDirection ?? null) as any,
      isBilled: t.isBilled,
      orderIndex: t.orderIndex,
      // O ecrã decide "é meu?" por createdById: usamos a empresa dona do registo.
      createdById: t.company,
      createdByCompany: t.company as any,
      createdByName: t.createdBy?.name ?? null,
      attachments: t.attachments.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        contentType: f.contentType ?? null,
        fileSize: f.fileSize ?? null,
        isPublic: f.isPublic,
        createdAt: f.createdAt.toISOString(),
      })),
      links,
      allocatedAmount: links.reduce((s, l) => s + Number(l.amount ?? 0), 0),
    };
  });
}
