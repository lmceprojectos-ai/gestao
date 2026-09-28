'use client'

import { motion } from 'framer-motion'
import { Pencil, Trash2, Inbox, Link2, Paperclip } from 'lucide-react'
import type { EnrichedTransaction, SettlementStatus } from '@/lib/parceiros/calc'
import { formatEUR, formatSigned, formatDatePT } from '@/lib/parceiros/format'

interface Props {
  rows: EnrichedTransaction[]
  user: { id?: string; company: string | null; isAdmin: boolean }
  currentUserId: string
  onEdit: (t: EnrichedTransaction) => void
  onDelete: (t: EnrichedTransaction) => void
  onReconcile: (t: EnrichedTransaction) => void
}

function SettlementBadge({ status }: { status: SettlementStatus | null }) {
  if (status === 'PAID')
    return (
      <span className="inline-block rounded-full bg-[hsl(142_55%_90%)] text-[hsl(142_60%_25%)] px-2 py-0.5 text-[11px] font-medium">
        Liquidado
      </span>
    )
  if (status === 'PARTIAL')
    return (
      <span className="inline-block rounded-full bg-[hsl(28_90%_90%)] text-[hsl(24_80%_32%)] px-2 py-0.5 text-[11px] font-medium">
        Parcial
      </span>
    )
  return (
    <span className="inline-block rounded-full bg-secondary text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
      Por liquidar
    </span>
  )
}

function rowClass(type: string): string {
  if (type === 'DEBIT') return 'row-debit'
  if (type === 'CREDIT') return 'row-credit'
  return 'row-payment'
}

function MoneyPos({ value }: { value: number | null }) {
  const v = Number(value ?? 0)
  if (!value || v <= 0) return <span className="text-muted-foreground/50">—</span>
  return <span className="font-mono">{formatEUR(v)}</span>
}

function Signed({ value }: { value: number }) {
  const v = Number(value ?? 0)
  if (v === 0) return <span className="text-muted-foreground/50">—</span>
  return (
    <span className={`font-mono font-semibold ${v > 0 ? 'val-pos' : 'val-neg'}`}>
      {formatSigned(v)}
    </span>
  )
}

export function LedgerTable({ rows, currentUserId, user, onEdit, onDelete, onReconcile }: Props) {
  const canModify = (t: EnrichedTransaction) =>
    Boolean(user?.isAdmin) || t?.createdById === currentUserId

  if (!rows?.length) {
    return (
      <div className="rounded-xl bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-secondary p-4 mb-4">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-medium">Sem registos</p>
        <p className="text-sm text-muted-foreground mt-1">
          Não há registos que correspondam aos filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm border-collapse">
          <thead>
            <tr className="bg-primary text-primary-foreground text-left">
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Data</th>
              <th className="px-3 py-3 font-semibold">Descrição / Trabalhos</th>
              <th className="px-3 py-3 font-semibold">Referência</th>
              <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Débito</th>
              <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Crédito</th>
              <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Movimento</th>
              <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Saldo Acum.</th>
              <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Estado</th>
              <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.3) }}
                className={`${rowClass(t?.type)} border-b border-border/60 transition-colors`}
              >
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                  {formatDatePT(t?.date)}
                </td>
                <td className="px-3 py-2.5 max-w-[320px]">
                  <span className="line-clamp-2">{t?.description}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  {t?.reference || <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <MoneyPos value={t?.debit} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <MoneyPos value={t?.credit} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Signed value={Number(t?.movement ?? 0)} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Signed value={Number(t?.balance ?? 0)} />
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    {t?.isBilled ? (
                      <span className="inline-block rounded-full bg-[hsl(43_90%_88%)] text-[hsl(35_80%_28%)] px-2.5 py-0.5 text-xs font-medium">
                        Faturado
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-secondary text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
                        Não Fat.
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <SettlementBadge status={t?.settlementStatus ?? null} />
                      {(t?.attachments?.length ?? 0) > 0 ? (
                        <span
                          className="inline-flex items-center text-muted-foreground"
                          title={`${t.attachments.length} documento(s)`}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onReconcile(t)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                      aria-label="Reconciliar e documentos"
                      title="Reconciliar / Documentos"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    {canModify(t) ? (
                      <>
                        <button
                          onClick={() => onEdit(t)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                        aria-label="Editar registo"
                        title="Editar"
                      >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(t)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="Eliminar registo"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
