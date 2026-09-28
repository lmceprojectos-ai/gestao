'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { EnrichedTransaction, TransactionType } from '@/lib/parceiros/calc'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  user: { company: string | null; isAdmin: boolean }
  editTx: EnrichedTransaction | null
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'

function allowedTypes(company: string | null, isAdmin: boolean): TransactionType[] {
  if (isAdmin) return ['DEBIT', 'CREDIT', 'PAYMENT']
  if (company === 'CRIACONSENSOS') return ['DEBIT', 'PAYMENT']
  if (company === 'RECLAMARTE') return ['CREDIT', 'PAYMENT']
  return []
}

const TYPE_OPTION_LABELS: Record<TransactionType, string> = {
  DEBIT: 'Débito — trabalho da Criaconsensos',
  CREDIT: 'Crédito — trabalho da Reclamarte',
  PAYMENT: 'Pagamento',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionFormDialog({ open, onOpenChange, onSaved, user, editTx }: Props) {
  const types = allowedTypes(user?.company ?? null, Boolean(user?.isAdmin))
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TransactionType>(types[0] ?? 'DEBIT')
  const [paymentDirection, setPaymentDirection] = useState<'A_PAYS_B' | 'B_PAYS_A'>('A_PAYS_B')
  const [isBilled, setIsBilled] = useState(false)
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editTx) {
      setDate(String(editTx?.date ?? todayStr()).slice(0, 10))
      setDescription(editTx?.description ?? '')
      setReference(editTx?.reference ?? '')
      setAmount(String(editTx?.amount ?? ''))
      setType((editTx?.type ?? types[0] ?? 'DEBIT') as TransactionType)
      setPaymentDirection((editTx?.paymentDirection ?? 'A_PAYS_B') as any)
      setIsBilled(Boolean(editTx?.isBilled))
      setNotify(true)
    } else {
      setDate(todayStr())
      setDescription('')
      setReference('')
      setAmount('')
      setType(types[0] ?? 'DEBIT')
      setPaymentDirection('A_PAYS_B')
      setIsBilled(false)
      setNotify(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTx])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!description.trim()) {
      toast.error('Indique a descrição do trabalho.')
      return
    }
    if (!date) {
      toast.error('Indique a data.')
      return
    }
    if (Number.isNaN(amt) || amt < 0) {
      toast.error('Indique um valor válido.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        date,
        description: description.trim(),
        reference: reference.trim() || null,
        amount: amt,
        type,
        paymentDirection: type === 'PAYMENT' ? paymentDirection : null,
        isBilled,
        notify,
      }
      const url = editTx ? `/api/parceiros/transactions/${editTx.id}` : '/api/parceiros/transactions'
      const method = editTx ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível guardar o registo.')
        return
      }
      toast.success(editTx ? 'Registo atualizado.' : 'Registo criado.')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error('Ocorreu um erro ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editTx ? 'Editar registo' : 'Novo registo'}
          </DialogTitle>
          <DialogDescription>
            {editTx
              ? 'Atualize os dados do registo da conta corrente.'
              : 'Adicione um trabalho, serviço ou pagamento à conta corrente.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição / Trabalhos</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Ex.: Impressão de vinil mate..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference">Referência (cliente / projeto)</Label>
            <Input
              id="reference"
              placeholder="Ex.: Blue Bizz"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo</Label>
            <select
              id="type"
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {TYPE_OPTION_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {type === 'PAYMENT' ? (
            <div className="space-y-1.5">
              <Label htmlFor="direction">Sentido do pagamento</Label>
              <select
                id="direction"
                className={selectClass}
                value={paymentDirection}
                onChange={(e) => setPaymentDirection(e.target.value as any)}
              >
                <option value="A_PAYS_B">Criaconsensos paga à Reclamarte</option>
                <option value="B_PAYS_A">Reclamarte paga à Criaconsensos</option>
              </select>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
            <div>
              <Label htmlFor="billed" className="cursor-pointer">
                Faturado
              </Label>
              <p className="text-xs text-muted-foreground">
                Marque se este registo já foi faturado.
              </p>
            </div>
            <Switch id="billed" checked={isBilled} onCheckedChange={setIsBilled} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
            <div>
              <Label htmlFor="notify" className="cursor-pointer">
                Notificar por email
              </Label>
              <p className="text-xs text-muted-foreground">
                Enviar email às duas empresas sobre esta alteração.
              </p>
            </div>
            <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A guardar...
                </>
              ) : editTx ? (
                'Guardar alterações'
              ) : (
                'Adicionar registo'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
