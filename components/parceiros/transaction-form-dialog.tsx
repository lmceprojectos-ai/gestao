'use client'
import { useConta } from '@/components/parceiros/conta'

import { useEffect, useMemo, useState } from 'react'
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
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/parceiros/calc'
import type { EnrichedTransaction, TransactionType, PaymentMethod } from '@/lib/parceiros/calc'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (guardado?: { id?: string; novoPagamento?: boolean }) => void
  user: { company: string | null; isAdmin: boolean }
  editTx: EnrichedTransaction | null
  allRows?: EnrichedTransaction[]
}

const eur = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',')} €`
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
function dataPT(d: string) {
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'

function allowedTypes(company: string | null, isAdmin: boolean): TransactionType[] {
  if (isAdmin) return ['DEBIT', 'CREDIT', 'PAYMENT']
  if (company === 'CRIACONSENSOS') return ['DEBIT', 'PAYMENT']
  if (company === 'PARCEIRO') return ['CREDIT', 'PAYMENT']
  return []
}

function typeOptionLabels(nome: string): Record<TransactionType, string> {
  return { DEBIT: 'Débito — trabalho da Criaconsensos', CREDIT: `Crédito — trabalho de ${nome}`, PAYMENT: 'Pagamento' }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionFormDialog({ open, onOpenChange, onSaved, user, editTx, allRows = [] }: Props) {
  const conta = useConta()
  const types = allowedTypes(user?.company ?? null, Boolean(user?.isAdmin))
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TransactionType>(types[0] ?? 'DEBIT')
  const [paymentDirection, setPaymentDirection] = useState<'A_PAYS_B' | 'B_PAYS_A'>('A_PAYS_B')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [isBilled, setIsBilled] = useState(false)
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  // Reconciliação no próprio registo: trabalho -> valor a aplicar deste pagamento
  const [ligar, setLigar] = useState<Record<string, string>>({})

  const novoPagamento = !editTx && type === 'PAYMENT'
  // Trabalhos por liquidar do mesmo grupo (com fatura / sem fatura) que o pagamento
  const trabalhos = useMemo(
    () =>
      novoPagamento
        ? allRows.filter((r) => (r.type === 'DEBIT' || r.type === 'CREDIT') && Number(r.outstanding ?? 0) > 0.001 && Boolean(r.isBilled) === isBilled)
        : [],
    [novoPagamento, allRows, isBilled]
  )
  const totalLigado = round2(Object.entries(ligar).reduce((s, [id, v]) => (trabalhos.some((t) => t.id === id) ? s + (Number(String(v).replace(',', '.')) || 0) : s), 0))
  const porAplicar = round2((Number(amount) || 0) - totalLigado)

  const alternarTrabalho = (t: EnrichedTransaction) => {
    setLigar((atual) => {
      const n = { ...atual }
      if (t.id in n) delete n[t.id]
      else {
        const livre = round2((Number(amount) || 0) - totalLigado)
        const sugerido = livre > 0 ? Math.min(Number(t.outstanding ?? 0), livre) : Number(t.outstanding ?? 0)
        n[t.id] = sugerido.toFixed(2)
      }
      return n
    })
  }

  useEffect(() => {
    if (!open) return
    setLigar({})
    if (editTx) {
      setDate(String(editTx?.date ?? todayStr()).slice(0, 10))
      setDescription(editTx?.description ?? '')
      setReference(editTx?.reference ?? '')
      setAmount(String(editTx?.amount ?? ''))
      setType((editTx?.type ?? types[0] ?? 'DEBIT') as TransactionType)
      setPaymentDirection((editTx?.paymentDirection ?? 'A_PAYS_B') as any)
      setPaymentMethod((editTx?.paymentMethod ?? '') as PaymentMethod | '')
      setIsBilled(Boolean(editTx?.isBilled))
      setNotify(true)
    } else {
      setDate(todayStr())
      setDescription('')
      setReference('')
      setAmount('')
      setType(types[0] ?? 'DEBIT')
      setPaymentDirection('A_PAYS_B')
      setPaymentMethod('')
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
    if (type === 'PAYMENT' && !paymentMethod) {
      toast.error('Escolha a forma de pagamento.')
      return
    }
    const ligacoes = novoPagamento
      ? trabalhos.filter((t) => t.id in ligar).map((t) => ({ t, valor: round2(Number(String(ligar[t.id]).replace(',', '.')) || 0) }))
      : []
    for (const { t, valor } of ligacoes) {
      if (!(valor > 0) || valor - 0.001 > Number(t.outstanding ?? 0)) {
        toast.error(`Valor inválido para "${t.description.slice(0, 40)}" (em falta: ${eur(Number(t.outstanding ?? 0))}).`)
        return
      }
    }
    if (ligacoes.length && totalLigado - 0.001 > amt) {
      toast.error(`Os trabalhos escolhidos (${eur(totalLigado)}) ultrapassam o valor do pagamento (${eur(amt)}).`)
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
        paymentMethod: type === 'PAYMENT' ? paymentMethod : null,
        isBilled,
        notify,
      }
      const url = editTx ? `/api/parceiros/transactions/${editTx.id}` : `/api/parceiros/transactions?conta=${conta.id}`
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
      // Ligar logo o pagamento aos trabalhos escolhidos
      let ligados = 0
      for (const { t, valor } of ligacoes) {
        const r = await fetch('/api/parceiros/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: data?.id, workId: t.id, amount: valor }),
        })
        if (r.ok) ligados++
        else {
          const e = await r.json().catch(() => ({}))
          toast.error(`Não foi possível ligar "${t.description.slice(0, 40)}": ${e?.message ?? 'erro'}`)
        }
      }
      toast.success(
        editTx ? 'Registo atualizado.'
          : novoPagamento && ligados ? `Pagamento criado e reconciliado com ${ligados} trabalho(s).`
          : novoPagamento ? 'Pagamento criado. Indique agora a que trabalho(s) se refere.'
          : 'Registo criado.'
      )
      onOpenChange(false)
      // Sem trabalhos escolhidos, abre-se a janela de reconciliação a seguir.
      onSaved({ id: data?.id, novoPagamento: novoPagamento && ligacoes.length === 0 })
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
            <Label htmlFor="reference">N.º da fatura ou do orçamento</Label>
            <Input
              id="reference"
              placeholder="Ex.: FT 2026/123 ou ORC 2026/45"
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
                  {typeOptionLabels(conta.nome)[t]}
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
                <option value="A_PAYS_B">Criaconsensos paga a {conta.nome}</option>
                <option value="B_PAYS_A">{conta.nome} paga à Criaconsensos</option>
              </select>
            </div>
          ) : null}

          {type === 'PAYMENT' ? (
            <div className="space-y-1.5">
              <Label htmlFor="method">Forma de pagamento</Label>
              <select
                id="method"
                className={selectClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="" disabled>Escolha a forma de pagamento…</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          ) : null}

          {novoPagamento && paymentMethod ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <Label>A que trabalho(s) se refere este pagamento?</Label>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{isBilled ? 'Com fatura' : 'Sem fatura'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mostra os trabalhos {isBilled ? 'com' : 'sem'} fatura por liquidar (mude em “Faturado”, mais abaixo). Pode escolher vários e ajustar o valor de cada um.
              </p>
              {trabalhos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Não há trabalhos {isBilled ? 'com' : 'sem'} fatura por liquidar.</p>
              ) : (
                <ul className="max-h-60 overflow-y-auto divide-y divide-border/60 rounded-md border border-border/60">
                  {trabalhos.map((t) => {
                    const marcado = t.id in ligar
                    return (
                      <li key={t.id} className={`flex items-start gap-2 px-2.5 py-2 text-sm ${marcado ? 'bg-secondary/60' : ''}`}>
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={marcado} onChange={() => alternarTrabalho(t)} aria-label={`Ligar a ${t.description}`} />
                        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => alternarTrabalho(t)}>
                          <span className="block truncate font-medium">{t.description}</span>
                          <span className="block text-xs text-muted-foreground">
                            {dataPT(t.date)} · {t.type === 'DEBIT' ? 'Criaconsensos' : conta.nome}
                            {t.reference ? ` · ${t.reference}` : ''} · em falta {eur(Number(t.outstanding ?? 0))}
                          </span>
                        </button>
                        {marcado ? (
                          <Input
                            className="h-8 w-24 shrink-0 text-right"
                            inputMode="decimal"
                            value={ligar[t.id]}
                            onChange={(e) => setLigar((a) => ({ ...a, [t.id]: e.target.value }))}
                            aria-label="Valor a aplicar"
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
              {Object.keys(ligar).length ? (
                <p className={`text-xs ${porAplicar < -0.001 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  Aplicado: {eur(totalLigado)} · {porAplicar < -0.001 ? `excede o pagamento em ${eur(-porAplicar)}` : `por aplicar: ${eur(porAplicar)}`}
                </p>
              ) : null}
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
