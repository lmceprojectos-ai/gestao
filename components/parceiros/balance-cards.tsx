'use client'

import { useConta } from '@/components/parceiros/conta'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileCheck2, FileClock, Scale } from 'lucide-react'
import type { Totals } from '@/lib/parceiros/calc'
import { formatSigned } from '@/lib/parceiros/format'

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const from = fromRef.current
    const to = Number(target ?? 0)
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = from + (to - from) * eased
      setVal(cur)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function perspective(v: number, nome: string): string {
  if (v > 0) return `${nome} deve à Criaconsensos`
  if (v < 0) return `Criaconsensos deve a ${nome}`
  return 'Saldo liquidado'
}

function Card({
  title,
  value,
  icon,
  accent,
  delay,
}: {
  title: string
  value: number
  icon: React.ReactNode
  accent: string
  delay: number
}) {
  const { nome } = useConta()
  const animated = useCountUp(value)
  const v = Number(value ?? 0)
  const valueClass = v > 0 ? 'val-pos' : v < 0 ? 'val-neg' : 'text-muted-foreground'
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md hover:shadow-lg transition-shadow"
    >
      <div className={`absolute left-0 top-0 h-full w-1.5 ${accent}`} />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className={`font-mono text-2xl font-bold tracking-tight mt-2 ${valueClass}`}>
            {formatSigned(animated)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">{perspective(v, nome)}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-secondary p-2 text-primary">{icon}</div>
      </div>
    </motion.div>
  )
}

export function BalanceCards({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card
        title="Saldo Faturado"
        value={Number(totals?.billed ?? 0)}
        icon={<FileCheck2 className="h-5 w-5" />}
        accent="bg-[hsl(212_52%_25%)]"
        delay={0}
      />
      <Card
        title="Saldo Não Faturado"
        value={Number(totals?.unbilled ?? 0)}
        icon={<FileClock className="h-5 w-5" />}
        accent="bg-[hsl(43_90%_55%)]"
        delay={0.08}
      />
      <Card
        title="Saldo Total"
        value={Number(totals?.total ?? 0)}
        icon={<Scale className="h-5 w-5" />}
        accent="bg-[hsl(142_55%_35%)]"
        delay={0.16}
      />
    </div>
  )
}
