'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus,
  Building2,
  Coins,
  CalendarDays,
  Loader2,
  LayoutDashboard,
  ScrollText,
  HandCoins,
} from 'lucide-react'
import { enrich, type EnrichedTransaction, type Totals } from '@/lib/parceiros/calc'
import { formatSigned } from '@/lib/parceiros/format'
import { AppHeader } from '@/components/parceiros/app-header'
import { BalanceCards } from '@/components/parceiros/balance-cards'
import { SettlementPanel } from '@/components/parceiros/settlement-panel'
import { LedgerFilters, EMPTY_FILTERS, type Filters } from '@/components/parceiros/ledger-filters'
import { LedgerTable } from '@/components/parceiros/ledger-table'
import { ReconcileDialog } from '@/components/parceiros/reconcile-dialog'
import { TransactionFormDialog } from '@/components/parceiros/transaction-form-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface User {
  id: string
  name: string
  email: string
  company: string | null
  isAdmin: boolean
  temGestao?: boolean
}

interface Props {
  initialRows: EnrichedTransaction[]
  initialTotals: Totals
  user: User
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function applyDisplayFilters(list: EnrichedTransaction[], filters: Filters): EnrichedTransaction[] {
  const q = (filters?.search ?? '').toLowerCase().trim()
  return (list ?? []).filter((r) => {
    if (filters?.type !== 'all' && r?.type !== filters?.type) return false
    if (filters?.from && String(r?.date ?? '') < filters.from) return false
    if (filters?.to && String(r?.date ?? '') > filters.to) return false
    if (q) {
      const hay = `${r?.description ?? ''} ${r?.reference ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function GroupSubtotal({ label, value }: { label: string; value: number }) {
  const v = Number(value ?? 0)
  const cls = v > 0 ? 'val-pos' : v < 0 ? 'val-neg' : 'text-muted-foreground'
  return (
    <div className="flex items-center justify-between rounded-xl bg-card shadow-sm px-5 py-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`font-mono text-xl font-bold ${cls}`}>{formatSigned(v)}</span>
    </div>
  )
}

export function LedgerDashboard({ initialRows, initialTotals, user }: Props) {
  const [rows, setRows] = useState<EnrichedTransaction[]>(initialRows ?? [])
  const [totals, setTotals] = useState<Totals>(initialTotals ?? { billed: 0, unbilled: 0, total: 0 })
  const [billedFilters, setBilledFilters] = useState<Filters>(EMPTY_FILTERS)
  const [unbilledFilters, setUnbilledFilters] = useState<Filters>(EMPTY_FILTERS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTx, setEditTx] = useState<EnrichedTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnrichedTransaction | null>(null)
  const [reconcileId, setReconcileId] = useState<string | null>(null)
  const [notifyDelete, setNotifyDelete] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const canAdd = Boolean(user?.isAdmin) || Boolean(user?.company)

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/parceiros/transactions', { cache: 'no-store' })
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setRows(data?.rows ?? [])
      setTotals(data?.totals ?? { billed: 0, unbilled: 0, total: 0 })
    } catch (e) {
      toast.error('Não foi possível atualizar os registos.')
    } finally {
      setRefreshing(false)
    }
  }

  // Recompute independent running balances for each group (billed / unbilled).
  const billed = useMemo(() => enrich((rows ?? []).filter((r) => r?.isBilled)), [rows])
  const unbilled = useMemo(() => enrich((rows ?? []).filter((r) => !r?.isBilled)), [rows])

  const billedDisplay = useMemo(
    () => applyDisplayFilters(billed.rows, billedFilters),
    [billed.rows, billedFilters]
  )
  const unbilledDisplay = useMemo(
    () => applyDisplayFilters(unbilled.rows, unbilledFilters),
    [unbilled.rows, unbilledFilters]
  )

  const openNew = () => {
    setEditTx(null)
    setDialogOpen(true)
  }
  const openEdit = (t: EnrichedTransaction) => {
    setEditTx(t)
    setDialogOpen(true)
  }
  const openReconcile = (t: EnrichedTransaction) => setReconcileId(t.id)

  const reconcileTx = useMemo(
    () => (rows ?? []).find((r) => r.id === reconcileId) ?? null,
    [rows, reconcileId]
  )

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/parceiros/transactions/${deleteTarget.id}?notify=${notifyDelete ? 'true' : 'false'}`,
        { method: 'DELETE' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível eliminar.')
        return
      }
      toast.success('Registo eliminado.')
      setDeleteTarget(null)
      await refresh()
    } catch (e) {
      toast.error('Ocorreu um erro ao eliminar.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />

      <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Conta corrente entre parceiros
            </h1>
            <p className="text-muted-foreground mt-1">
              Trabalhos com e sem fatura acertados em separado — na perspetiva da Criaconsensos.
            </p>
          </div>
          {canAdd ? (
            <Button onClick={openNew} className="gap-1.5 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> Novo registo
            </Button>
          ) : null}
        </motion.div>

        <div className="rounded-xl bg-card shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <InfoRow
              label="Empresa A"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Criaconsensos
                </span>
              }
            />
            <InfoRow
              label="Empresa B"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[hsl(142_55%_35%)]" /> Reclamarte
                </span>
              }
            />
            <InfoRow
              label="Moeda"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-accent" /> EUR
                </span>
              }
            />
            <InfoRow
              label="Ano"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> 2026
                </span>
              }
            />
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-10 gap-1 sm:gap-0">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Encontro de contas
            </TabsTrigger>
            <TabsTrigger value="billed" className="gap-1.5">
              <ScrollText className="h-4 w-4" /> Trabalhos com fatura
            </TabsTrigger>
            <TabsTrigger value="unbilled" className="gap-1.5">
              <HandCoins className="h-4 w-4" /> Trabalhos sem fatura
            </TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <BalanceCards totals={totals} />
            <SettlementPanel totals={totals} />
          </TabsContent>

          {/* COM FATURA */}
          <TabsContent value="billed" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Trabalhos com fatura</h2>
                <p className="text-sm text-muted-foreground">
                  {billedDisplay?.length ?? 0} de {billed.rows?.length ?? 0} registos
                </p>
              </div>
              {refreshing ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> a atualizar
                </span>
              ) : null}
            </div>
            <LedgerFilters filters={billedFilters} onChange={setBilledFilters} hideBilled />
            <LedgerTable
              rows={billedDisplay}
              user={user}
              currentUserId={user?.company ?? ''}
              onEdit={openEdit}
              onDelete={(t) => setDeleteTarget(t)}
              onReconcile={openReconcile}
            />
            <GroupSubtotal label="Saldo a acertar (com fatura)" value={billed.totals.total} />
          </TabsContent>

          {/* SEM FATURA */}
          <TabsContent value="unbilled" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Trabalhos sem fatura</h2>
                <p className="text-sm text-muted-foreground">
                  {unbilledDisplay?.length ?? 0} de {unbilled.rows?.length ?? 0} registos
                </p>
              </div>
              {refreshing ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> a atualizar
                </span>
              ) : null}
            </div>
            <LedgerFilters filters={unbilledFilters} onChange={setUnbilledFilters} hideBilled />
            <LedgerTable
              rows={unbilledDisplay}
              user={user}
              currentUserId={user?.company ?? ''}
              onEdit={openEdit}
              onDelete={(t) => setDeleteTarget(t)}
              onReconcile={openReconcile}
            />
            <GroupSubtotal label="Saldo a acertar (sem fatura)" value={unbilled.totals.total} />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Cada empresa regista apenas os seus próprios trabalhos. Qualquer alteração notifica ambas
          as partes por email.
        </p>
      </main>

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        user={user}
        editTx={editTx}
      />

      <ReconcileDialog
        open={!!reconcileId}
        onOpenChange={(v) => {
          if (!v) setReconcileId(null)
        }}
        tx={reconcileTx}
        allRows={rows}
        user={user}
        onChanged={refresh}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
          else setNotifyDelete(true)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O registo “{deleteTarget?.description ?? ''}” será removido e
              os saldos serão recalculados.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
            <Label htmlFor="notify-delete" className="cursor-pointer">
              Notificar as empresas por email
            </Label>
            <Switch id="notify-delete" checked={notifyDelete} onCheckedChange={setNotifyDelete} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A eliminar...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
