'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CATEGORIES, CONTACT_TYPES, type SubjectType, type CollaboratorType, type CategoryType } from '@/lib/conexus/types'
import { Save, X } from 'lucide-react'

interface SubjectFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  collaborators: CollaboratorType[]
  editingSubject: SubjectType | null
}

export function SubjectFormModal({ open, onClose, onSubmit, collaborators, editingSubject }: SubjectFormModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [contactType, setContactType] = useState('interno')
  const [workType, setWorkType] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('media')
  const [category, setCategory] = useState('geral')
  const [collaboratorId, setCollaboratorId] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTimeVal, setReminderTimeVal] = useState('')
  const [scope, setScope] = useState('profissional')
  const [urgent, setUrgent] = useState(false)
  const [important, setImportant] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<CategoryType[]>([])

  useEffect(() => {
    fetch('/api/conexus/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data)
        } else {
          setCategories(CATEGORIES.map((c, i) => ({ id: c.value, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: i, active: true, visibleOnDashboard: true })))
        }
      })
      .catch(() => {
        setCategories(CATEGORIES.map((c, i) => ({ id: c.value, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: i, active: true, visibleOnDashboard: true })))
      })
  }, [])

  useEffect(() => {
    if (editingSubject) {
      setTitle(editingSubject?.title ?? '')
      setDescription(editingSubject?.description ?? '')
      setClient(editingSubject?.client ?? '')
      setContactType(editingSubject?.contactType ?? 'interno')
      setWorkType(editingSubject?.workType ?? '')
      setDeadline(editingSubject?.deadline ? editingSubject.deadline.split('T')[0] ?? '' : '')
      setPriority(editingSubject?.priority ?? 'media')
      setCategory(editingSubject?.category ?? 'geral')
      setCollaboratorId(editingSubject?.collaboratorId ?? '')
      setScope(editingSubject?.scope ?? 'profissional')
      setUrgent(editingSubject?.urgent ?? false)
      setImportant(editingSubject?.important ?? false)
      if (editingSubject?.reminderDate) {
        const rd = new Date(editingSubject.reminderDate)
        setReminderDate(rd.toISOString().split('T')[0] ?? '')
        setReminderTimeVal(rd.toISOString().split('T')[1]?.substring(0, 5) ?? '')
      } else {
        setReminderDate('')
        setReminderTimeVal('')
      }
    } else {
      setTitle('')
      setDescription('')
      setClient('')
      setContactType('interno')
      setWorkType('')
      setDeadline('')
      setPriority('media')
      setCategory('geral')
      setCollaboratorId('')
      setScope('profissional')
      setUrgent(false)
      setImportant(false)
      setReminderDate('')
      setReminderTimeVal('')
    }
  }, [editingSubject])

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!title?.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        title: title?.trim(),
        description,
        client,
        contactType,
        workType,
        deadline: deadline || null,
        priority,
        category,
        scope,
        urgent,
        important,
        collaboratorId: collaboratorId || null,
        reminderDate: (reminderDate && reminderTimeVal) ? new Date(`${reminderDate}T${reminderTimeVal}:00Z`).toISOString() : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val: boolean) => { if (!val) onClose() }}>
      <DialogContent className="sm:max-w-[700px] md:max-w-[780px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border-0 ring-1 ring-black/5">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editingSubject ? 'Editar Assunto' : 'Novo Assunto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e?.target?.value ?? '')}
              placeholder="Título do assunto"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e?.target?.value ?? '')}
              placeholder="Descrição do assunto"
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Âmbito</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setScope('profissional')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 ${
                  scope === 'profissional'
                    ? 'bg-[#1e3a5f] text-white border-transparent shadow-sm'
                    : 'bg-background border-border text-foreground hover:bg-muted'
                }`}
              >
                💼 Profissional
              </button>
              <button
                type="button"
                onClick={() => setScope('pessoal')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 ${
                  scope === 'pessoal'
                    ? 'bg-purple-600 text-white border-transparent shadow-sm'
                    : 'bg-background border-border text-foreground hover:bg-muted'
                }`}
              >
                👤 Pessoal
              </button>
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-1.5 ${
                    category === cat.value
                      ? `${cat.color} text-white border-transparent shadow-sm`
                      : 'bg-background border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Cliente / Contacto</Label>
              <Input
                id="client"
                value={client}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClient(e?.target?.value ?? '')}
                placeholder="Nome do cliente ou contacto"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de Post-it</Label>
              <div className="flex gap-2 mt-1">
                {CONTACT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setContactType(ct.value)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border text-center ${
                      contactType === ct.value
                        ? 'bg-[#1e3a5f] text-white border-transparent shadow-sm'
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="mr-1">{ct.icon}</span>{ct.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="workType">Tipo de Trabalho</Label>
            <Input
              id="workType"
              value={workType}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWorkType(e?.target?.value ?? '')}
              placeholder="Ex: Contabilidade, Fiscal"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deadline">Prazo de Entrega</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeadline(e?.target?.value ?? '')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reminderDate">Data do Lembrete</Label>
              <Input
                id="reminderDate"
                type="date"
                value={reminderDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReminderDate(e?.target?.value ?? '')}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reminderTimeVal">Hora do Lembrete</Label>
              <Input
                id="reminderTimeVal"
                type="time"
                value={reminderTimeVal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReminderTimeVal(e?.target?.value ?? '')}
                className="mt-1"
              />
              {reminderDate && !reminderTimeVal && (
                <p className="text-xs text-amber-600 mt-1">Defina também a hora</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <div className="flex gap-2 mt-1">
                {[
                  { value: 'alta', label: 'Alta', color: 'bg-red-500' },
                  { value: 'media', label: 'Média', color: 'bg-amber-500' },
                  { value: 'baixa', label: 'Baixa', color: 'bg-emerald-500' },
                ].map((p: any) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                      priority === p.value
                        ? `${p.color} text-white border-transparent shadow-sm`
                        : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="collaborator">Colaborador</Label>
              <select
                id="collaborator"
                value={collaboratorId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCollaboratorId(e?.target?.value ?? '')}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem atribuição</option>
                {(collaborators ?? []).map((c: CollaboratorType) => (
                  <option key={c?.id} value={c?.id}>{c?.name ?? ''}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Eisenhower Matrix - 4 quadrants */}
          <div>
            <Label>Matriz de Eisenhower</Label>
            <p className="text-xs text-muted-foreground mb-2">Selecione o quadrante adequado</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setUrgent(true); setImportant(true) }}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                  urgent && important
                    ? 'bg-red-500 text-white border-transparent shadow-sm ring-2 ring-red-300'
                    : 'bg-background border-border text-foreground hover:bg-red-50'
                }`}
              >
                <span className="text-base">🚨</span>
                <span className="font-semibold">Fazer Agora</span>
                <span className={`text-[10px] ${urgent && important ? 'text-white/80' : 'text-muted-foreground'}`}>Urgente + Importante</span>
              </button>
              <button
                type="button"
                onClick={() => { setUrgent(false); setImportant(true) }}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                  !urgent && important
                    ? 'bg-blue-500 text-white border-transparent shadow-sm ring-2 ring-blue-300'
                    : 'bg-background border-border text-foreground hover:bg-blue-50'
                }`}
              >
                <span className="text-base">📅</span>
                <span className="font-semibold">Agendar</span>
                <span className={`text-[10px] ${!urgent && important ? 'text-white/80' : 'text-muted-foreground'}`}>Importante, não urgente</span>
              </button>
              <button
                type="button"
                onClick={() => { setUrgent(true); setImportant(false) }}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                  urgent && !important
                    ? 'bg-amber-500 text-white border-transparent shadow-sm ring-2 ring-amber-300'
                    : 'bg-background border-border text-foreground hover:bg-amber-50'
                }`}
              >
                <span className="text-base">👥</span>
                <span className="font-semibold">Delegar</span>
                <span className={`text-[10px] ${urgent && !important ? 'text-white/80' : 'text-muted-foreground'}`}>Urgente, não importante</span>
              </button>
              <button
                type="button"
                onClick={() => { setUrgent(false); setImportant(false) }}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all border flex flex-col items-center gap-1 ${
                  !urgent && !important
                    ? 'bg-gray-400 text-white border-transparent shadow-sm ring-2 ring-gray-300'
                    : 'bg-background border-border text-foreground hover:bg-gray-50'
                }`}
              >
                <span className="text-base">🗑️</span>
                <span className="font-semibold">Adiar/Eliminar</span>
                <span className={`text-[10px] ${!urgent && !important ? 'text-white/80' : 'text-muted-foreground'}`}>Nem urgente nem importante</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button type="submit" disabled={saving || !title?.trim()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
              <Save className="h-4 w-4 mr-1" /> {editingSubject ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
