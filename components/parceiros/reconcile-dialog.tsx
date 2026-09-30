'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Paperclip,
  Link2,
  Download,
  Trash2,
  Loader2,
  Plus,
  FileText,
  Upload,
} from 'lucide-react'
import type { EnrichedTransaction } from '@/lib/parceiros/calc'
import { formatEUR, formatDatePT } from '@/lib/parceiros/format'
import { uploadFile, downloadAttachment } from '@/lib/parceiros/upload-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface User {
  id: string
  isAdmin: boolean
  company: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  tx: EnrichedTransaction | null
  allRows: EnrichedTransaction[]
  user: User
  onChanged: () => void
}

const TYPE_SHORT: Record<string, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  PAYMENT: 'Pagamento',
}

function statusBadge(status: string | null) {
  if (status === 'PAID')
    return (
      <span className="inline-block rounded-full bg-[hsl(142_55%_90%)] text-[hsl(142_60%_25%)] px-2.5 py-0.5 text-xs font-medium">
        Liquidado
      </span>
    )
  if (status === 'PARTIAL')
    return (
      <span className="inline-block rounded-full bg-[hsl(43_90%_88%)] text-[hsl(35_80%_28%)] px-2.5 py-0.5 text-xs font-medium">
        Parcial
      </span>
    )
  return (
    <span className="inline-block rounded-full bg-secondary text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
      Por liquidar
    </span>
  )
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ReconcileDialog({ open, onOpenChange, tx, allRows, user, onChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [busyAttId, setBusyAttId] = useState<string | null>(null)
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null)
  const [selectedCounterpart, setSelectedCounterpart] = useState('')
  const [linkAmount, setLinkAmount] = useState('')
  const [linking, setLinking] = useState(false)
  const [marcando, setMarcando] = useState(false)

  const isPayment = tx?.type === 'PAYMENT'
  const canModify = Boolean(user?.isAdmin) || (tx ? tx.createdById === user?.company : false)

  const linkedIds = useMemo(
    () => new Set((tx?.links ?? []).map((l) => l.otherId)),
    [tx?.links]
  )

  // Candidates for a new allocation.
  const candidates = useMemo(() => {
    if (!tx) return [] as EnrichedTransaction[]
    return (allRows ?? []).filter((r) => {
      if (r.id === tx.id) return false
      if (linkedIds.has(r.id)) return false
      if (Number(r.outstanding ?? 0) <= 0.001) return false
      if (isPayment) return r.type === 'DEBIT' || r.type === 'CREDIT'
      return r.type === 'PAYMENT'
    })
  }, [tx, allRows, linkedIds, isPayment])

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === selectedCounterpart) ?? null,
    [candidates, selectedCounterpart]
  )

  const onSelectCounterpart = (id: string) => {
    setSelectedCounterpart(id)
    const cand = candidates.find((c) => c.id === id)
    if (cand && tx) {
      const suggested = Math.min(Number(tx.outstanding ?? 0), Number(cand.outstanding ?? 0))
      setLinkAmount(suggested > 0 ? suggested.toFixed(2) : '')
    } else {
      setLinkAmount('')
    }
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tx) return
    if (file.size > 100 * 1024 * 1024) {
      toast.error('O ficheiro é demasiado grande (máx. 100 MB).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      const meta = await uploadFile(file)
      const res = await fetch(`/api/parceiros/transactions/${tx.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: meta.fileName,
          cloud_storage_path: meta.cloud_storage_path,
          contentType: meta.contentType,
          fileSize: meta.fileSize,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível guardar o documento.')
        return
      }
      toast.success('Documento anexado.')
      onChanged()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao anexar o documento.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (attId: string) => {
    setBusyAttId(attId)
    try {
      await downloadAttachment(attId)
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível obter o documento.')
    } finally {
      setBusyAttId(null)
    }
  }

  const handleDeleteAttachment = async (attId: string) => {
    setBusyAttId(attId)
    try {
      const res = await fetch(`/api/parceiros/attachments/${attId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível eliminar o documento.')
        return
      }
      toast.success('Documento eliminado.')
      onChanged()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao eliminar o documento.')
    } finally {
      setBusyAttId(null)
    }
  }

  const handleAddLink = async () => {
    if (!tx || !selectedCandidate) {
      toast.error('Selecione um registo para ligar.')
      return
    }
    const amount = Number(String(linkAmount).replace(',', '.'))
    if (!(amount > 0)) {
      toast.error('Indique um valor válido.')
      return
    }
    const paymentId = isPayment ? tx.id : selectedCandidate.id
    const workId = isPayment ? selectedCandidate.id : tx.id
    setLinking(true)
    try {
      const res = await fetch('/api/parceiros/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, workId, amount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível criar a ligação.')
        return
      }
      toast.success('Reconciliação registada.')
      setSelectedCounterpart('')
      setLinkAmount('')
      onChanged()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao reconciliar.')
    } finally {
      setLinking(false)
    }
  }

  // Marca (ou desmarca) como liquidado sem ligar a um pagamento.
  const marcarLiquidado = async (liquidado: boolean) => {
    if (!tx) return
    setMarcando(true)
    try {
      const res = await fetch(`/api/parceiros/transactions/${tx.id}/liquidado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liquidado }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível alterar o estado.')
        return
      }
      toast.success(liquidado ? 'Marcado como liquidado.' : 'Deixou de estar marcado como liquidado.')
      onChanged()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao alterar o estado.')
    } finally {
      setMarcando(false)
    }
  }

  const handleRemoveLink = async (allocationId: string) => {
    setBusyLinkId(allocationId)
    try {
      const res = await fetch(`/api/parceiros/allocations/${allocationId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Não foi possível remover a ligação.')
        return
      }
      toast.success('Ligação removida.')
      onChanged()
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao remover a ligação.')
    } finally {
      setBusyLinkId(null)
    }
  }

  if (!tx) return null

  const attachments = tx.attachments ?? []
  const links = tx.links ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Reconciliação e documentos
          </DialogTitle>
          <DialogDescription>
            {TYPE_SHORT[tx.type] ?? tx.type} · {formatDatePT(tx.date)} —{' '}
            <span className="font-medium text-foreground">{tx.description}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do estado de liquidação */}
        <div className="rounded-lg bg-secondary/50 px-4 py-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Valor</p>
            <p className="font-mono font-semibold">{formatEUR(tx.amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Reconciliado</p>
            <p className="font-mono font-semibold">{formatEUR(tx.allocatedAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Em falta</p>
            <p className="font-mono font-semibold">{formatEUR(tx.outstanding)}</p>
          </div>
          <div className="col-span-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {statusBadge(tx.settlementStatus)}
              {tx.liquidado ? <span className="text-xs text-muted-foreground">marcado à mão</span> : null}
            </span>
            {canModify && (tx.liquidado || tx.settlementStatus !== 'PAID') ? (
              <Button type="button" size="sm" variant="outline" disabled={marcando} onClick={() => marcarLiquidado(!tx.liquidado)}>
                {marcando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {tx.liquidado ? 'Desmarcar liquidado' : 'Marcar como liquidado'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* SECÇÃO RECONCILIAÇÃO */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-primary" />
            {isPayment ? 'Trabalhos liquidados por este pagamento' : 'Pagamentos aplicados a este trabalho'}
          </h3>

          {links.length ? (
            <ul className="space-y-2">
              {links.map((l) => (
                <li
                  key={l.allocationId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="text-muted-foreground text-xs">
                        {TYPE_SHORT[l.otherType] ?? l.otherType} · {formatDatePT(l.otherDate)}
                        {l.otherReference ? ` · ${l.otherReference}` : ''}
                      </span>
                      <br />
                      {l.otherDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold">{formatEUR(l.amount)}</span>
                    {canModify ? (
                      <button
                        onClick={() => handleRemoveLink(l.allocationId)}
                        disabled={busyLinkId === l.allocationId}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Remover ligação"
                      >
                        {busyLinkId === l.allocationId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem reconciliações.</p>
          )}

          {canModify ? (
            Number(tx.outstanding ?? 0) > 0.001 ? (
              <div className="rounded-lg bg-secondary/40 p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {isPayment ? 'Ligar a trabalho' : 'Ligar a pagamento'}
                  </Label>
                  <select
                    value={selectedCounterpart}
                    onChange={(e) => onSelectCounterpart(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Selecionar —</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {TYPE_SHORT[c.type] ?? c.type} · {formatDatePT(c.date)} ·{' '}
                        {c.description.slice(0, 40)}
                        {c.description.length > 40 ? '…' : ''} — em falta {formatEUR(c.outstanding)}
                      </option>
                    ))}
                  </select>
                  {!candidates.length ? (
                    <p className="text-xs text-muted-foreground">
                      Não há {isPayment ? 'trabalhos' : 'pagamentos'} por liquidar disponíveis.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs">Valor a aplicar (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linkAmount}
                      onChange={(e) => setLinkAmount(e.target.value)}
                      placeholder="0,00"
                      disabled={!selectedCandidate}
                    />
                  </div>
                  <Button
                    onClick={handleAddLink}
                    disabled={linking || !selectedCandidate}
                    className="gap-1.5"
                  >
                    {linking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Ligar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[hsl(142_60%_25%)] font-medium">
                Totalmente reconciliado.
              </p>
            )
          ) : null}
        </section>

        <div className="h-px bg-border" />

        {/* SECÇÃO DOCUMENTOS */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Paperclip className="h-4 w-4 text-primary" /> Documentos relacionados
          </h3>

          {attachments.length ? (
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{a.fileName}</span>
                    {a.fileSize ? (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(a.fileSize)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDownload(a.id)}
                      disabled={busyAttId === a.id}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-colors disabled:opacity-50"
                      title="Descarregar"
                    >
                      {busyAttId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                    {canModify ? (
                      <button
                        onClick={() => handleDeleteAttachment(a.id)}
                        disabled={busyAttId === a.id}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem documentos anexados.</p>
          )}

          {canModify ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx"
              />
              <Button
                variant="outline"
                onClick={handleUploadClick}
                disabled={uploading}
                className="gap-1.5"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> A enviar...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Anexar documento
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  )
}
