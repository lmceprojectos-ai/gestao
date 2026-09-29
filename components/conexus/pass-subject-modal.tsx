'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowRight, X } from 'lucide-react'

interface PassSubjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  subjectTitle: string
}

export function PassSubjectModal({ open, onClose, onSubmit, subjectTitle }: PassSubjectModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!reason?.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(reason?.trim())
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val: boolean) => { if (!val) onClose() }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Passar para Outro Dia</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O assunto <strong>"{subjectTitle}"</strong> será marcado como passado e criado automaticamente no dia seguinte.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="reason">Motivo *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e?.target?.value ?? '')}
              placeholder="Indique o motivo pelo qual o assunto passa para outro dia..."
              rows={3}
              required
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !reason?.trim()} className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white">
              <ArrowRight className="h-4 w-4 mr-1" /> Passar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
