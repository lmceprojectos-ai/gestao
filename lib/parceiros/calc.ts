// Empresa A é sempre a Criaconsensos; a empresa B é o parceiro da conta.
export type Company = 'CRIACONSENSOS' | 'PARCEIRO'
export type TransactionType = 'DEBIT' | 'CREDIT' | 'PAYMENT'
export type PaymentDirection = 'A_PAYS_B' | 'B_PAYS_A'
export type PaymentMethod = 'TRANSFERENCIA' | 'NUMERARIO' | 'ENCONTRO_CONTAS'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TRANSFERENCIA: 'Transferência bancária',
  NUMERARIO: 'Numerário',
  ENCONTRO_CONTAS: 'Encontro de contas',
}
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

export interface AttachmentDTO {
  id: string
  fileName: string
  contentType: string | null
  fileSize: number | null
  isPublic: boolean
  createdAt: string
}

export interface AllocationLinkDTO {
  allocationId: string
  otherId: string
  otherDate: string
  otherDescription: string
  otherReference: string | null
  otherType: TransactionType
  amount: number
}

export type SettlementStatus = 'PAID' | 'PARTIAL' | 'UNPAID'

export interface TransactionDTO {
  id: string
  date: string // yyyy-MM-dd
  description: string
  reference: string | null
  amount: number
  type: TransactionType
  paymentDirection: PaymentDirection | null
  paymentMethod: PaymentMethod | null
  liquidado: boolean // marcado à mão como liquidado
  isBilled: boolean
  orderIndex: number
  createdById: string
  createdByCompany: Company | null
  createdByName: string | null
  attachments: AttachmentDTO[]
  links: AllocationLinkDTO[]
  allocatedAmount: number
}

export interface EnrichedTransaction extends TransactionDTO {
  movement: number
  debit: number | null
  credit: number | null
  balance: number
  settlementStatus: SettlementStatus | null
  outstanding: number
}

export interface Totals {
  billed: number
  unbilled: number
  total: number
}

export function round2(n: number): number {
  return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100
}

export function movementOf(t: {
  type: TransactionType
  amount: number
  paymentDirection: PaymentDirection | null
}): number {
  const amt = Number(t?.amount ?? 0)
  if (t?.type === 'DEBIT') return amt
  if (t?.type === 'CREDIT') return -amt
  if (t?.type === 'PAYMENT') return t?.paymentDirection === 'B_PAYS_A' ? -amt : amt
  return 0
}

export function enrich(transactions: TransactionDTO[]): {
  rows: EnrichedTransaction[]
  totals: Totals
} {
  const sorted = [...(transactions ?? [])].sort(
    (a, b) => (a?.orderIndex ?? 0) - (b?.orderIndex ?? 0)
  )
  let running = 0
  let billed = 0
  let unbilled = 0
  const rows: EnrichedTransaction[] = sorted.map((t) => {
    const movement = round2(movementOf(t))
    running = round2(running + movement)
    if (t?.isBilled) billed = round2(billed + movement)
    else unbilled = round2(unbilled + movement)

    let debit: number | null = null
    let credit: number | null = null
    if (t?.type === 'DEBIT') debit = Number(t?.amount ?? 0)
    else if (t?.type === 'CREDIT') credit = Number(t?.amount ?? 0)
    else if (t?.type === 'PAYMENT') {
      if (movement >= 0) debit = Number(t?.amount ?? 0)
      else credit = Number(t?.amount ?? 0)
    }

    const amount = round2(Number(t?.amount ?? 0))
    const allocated = round2(Number(t?.allocatedAmount ?? 0))
    const outstanding = t?.liquidado ? 0 : round2(amount - allocated)
    let settlementStatus: SettlementStatus | null = null
    if (t?.type === 'DEBIT' || t?.type === 'CREDIT' || t?.type === 'PAYMENT') {
      if (t?.liquidado) settlementStatus = 'PAID'
      else if (allocated <= 0) settlementStatus = 'UNPAID'
      else if (allocated + 0.001 >= amount) settlementStatus = 'PAID'
      else settlementStatus = 'PARTIAL'
    }

    return { ...t, movement, debit, credit, balance: running, settlementStatus, outstanding }
  })

  return { rows, totals: { billed, unbilled, total: round2(billed + unbilled) } }
}

export function typeLabels(nomeParceiro: string): Record<TransactionType, string> {
  return {
    DEBIT: 'Débito (Criaconsensos executou)',
    CREDIT: `Crédito (${nomeParceiro} executou)`,
    PAYMENT: 'Pagamento',
  }
}

export function companyLabel(company: Company | string | null, nomeParceiro: string): string {
  return company === 'PARCEIRO' ? nomeParceiro : 'Criaconsensos'
}
