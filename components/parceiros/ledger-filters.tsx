'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export interface Filters {
  search: string
  type: string
  billed: string
  from: string
  to: string
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  type: 'all',
  billed: 'all',
  from: '',
  to: '',
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'

export function LedgerFilters({
  filters,
  onChange,
  hideBilled = false,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  hideBilled?: boolean
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const hasActive =
    filters.search !== '' ||
    filters.type !== 'all' ||
    (!hideBilled && filters.billed !== 'all') ||
    filters.from !== '' ||
    filters.to !== ''

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${hideBilled ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}>
        <div className="space-y-1.5 lg:col-span-1 sm:col-span-2">
          <Label className="text-xs">Pesquisar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Descrição ou n.º da fatura/orçamento"
              className="pl-10 h-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <select
            className={selectClass}
            value={filters.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="all">Todos</option>
            <option value="DEBIT">Débito</option>
            <option value="CREDIT">Crédito</option>
            <option value="PAYMENT">Pagamento</option>
          </select>
        </div>
        {hideBilled ? null : (
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <select
              className={selectClass}
              value={filters.billed}
              onChange={(e) => set({ billed: e.target.value })}
            >
              <option value="all">Todos</option>
              <option value="billed">Faturado</option>
              <option value="unbilled">Não Faturado</option>
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 lg:col-span-1">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
              className="h-9 px-2"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
              className="h-9 px-2"
            />
          </div>
        </div>
      </div>
      {hasActive ? (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        </div>
      ) : null}
    </div>
  )
}
