'use client'
import { useConta } from '@/components/parceiros/conta'

import { motion } from 'framer-motion'
import { ArrowRight, HandCoins, ScrollText, Scale } from 'lucide-react'
import type { Totals } from '@/lib/parceiros/calc'
import { formatEUR } from '@/lib/parceiros/format'

function who(v: number, nome: string): { text: string; cls: string } {
  if (v > 0) return { text: `${nome} deve à Criaconsensos`, cls: 'val-pos' }
  if (v < 0) return { text: `A Criaconsensos deve a ${nome}`, cls: 'val-neg' }
  return { text: 'Contas saldadas', cls: 'text-muted-foreground' }
}

function SettleRow({
  icon,
  label,
  hint,
  value,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  value: number
}) {
  const { nome } = useConta()
  const w = who(value, nome)
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary/60 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 rounded-lg bg-background p-2 text-primary shadow-sm">{icon}</div>
        <div className="min-w-0">
          <p className="font-medium text-sm">{label}</p>
          <p className={`text-xs ${w.cls}`}>{w.text}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-mono text-lg font-bold ${w.cls}`}>{formatEUR(Math.abs(value))}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

export function SettlementPanel({ totals }: { totals: Totals }) {
  const { nome } = useConta()
  const billed = Number(totals?.billed ?? 0)
  const unbilled = Number(totals?.unbilled ?? 0)
  const total = Number(totals?.total ?? 0)
  const w = who(total, nome)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl bg-card shadow-md overflow-hidden"
    >
      <div className="bg-primary text-primary-foreground px-5 py-4">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <Scale className="h-4 w-4" /> Encontro de contas
        </h3>
        <p className="text-xs text-primary-foreground/80 mt-0.5">
          Apuramento dos valores a acertar entre as duas empresas.
        </p>
      </div>

      <div className="p-5 space-y-3">
        <SettleRow
          icon={<ScrollText className="h-4 w-4" />}
          label="Trabalhos com fatura"
          hint="a acertar com fatura"
          value={billed}
        />
        <SettleRow
          icon={<HandCoins className="h-4 w-4" />}
          label="Trabalhos sem fatura"
          hint="a acertar sem fatura"
          value={unbilled}
        />

        <div className="h-px bg-border my-1" />

        <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground shadow-sm">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">Saldo global a acertar</p>
              <p className={`text-xs ${w.cls}`}>{w.text}</p>
            </div>
          </div>
          <p className={`font-mono text-2xl font-bold ${w.cls}`}>{formatEUR(Math.abs(total))}</p>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Os trabalhos com fatura e sem fatura são acertados em separado. O saldo global é apenas
          indicativo do total das duas parcelas.
        </p>
      </div>
    </motion.div>
  )
}
