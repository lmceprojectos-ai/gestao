'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Lock, CheckCircle2, Circle, Pencil, Trash2, Clock, X, Save, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/ui/animate'
import { VoiceNoteButton } from '@/components/conexus/voice-note-button'

interface PersonalNote {
  id: string
  title: string
  content: string
  date: string
  time: string | null
  priority: string
  done: boolean
  source?: string
  createdAt: string
  updatedAt: string
}

const priorityConfig: Record<string, { label: string; color: string; bg: string; text: string; hex: string }> = {
  alta: { label: 'Alta', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', hex: '#ef4444' },
  media: { label: 'Média', color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', hex: '#f59e0b' },
  baixa: { label: 'Baixa', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10b981' },
}

export function PersonalAgendaClient() {
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [notes, setNotes] = useState<PersonalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formPriority, setFormPriority] = useState('media')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  const fetchNotes = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conexus/personal-notes?date=${selectedDate}`)
      const data = await res.json()
      setNotes(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Erro ao carregar notas')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (mounted && selectedDate) fetchNotes()
  }, [mounted, selectedDate, fetchNotes])

  const goToPrevDay = () => {
    if (!selectedDate) return
    setSelectedDate(format(subDays(new Date(selectedDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))
  }
  const goToNextDay = () => {
    if (!selectedDate) return
    setSelectedDate(format(addDays(new Date(selectedDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))
  }

  const openForm = (note?: PersonalNote) => {
    if (note) {
      setEditingNote(note)
      setFormTitle(note.title)
      setFormContent(note.content)
      setFormTime(note.time ?? '')
      setFormPriority(note.priority)
    } else {
      setEditingNote(null)
      setFormTitle('')
      setFormContent('')
      setFormTime('')
      setFormPriority('media')
    }
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!formTitle?.trim()) return
    setSaving(true)
    try {
      if (editingNote) {
        await fetch(`/api/conexus/personal-notes/${editingNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: formTitle.trim(), content: formContent, time: formTime || null, priority: formPriority }),
        })
        toast.success('Nota atualizada')
      } else {
        await fetch('/api/conexus/personal-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: formTitle.trim(), content: formContent, date: selectedDate, time: formTime || null, priority: formPriority }),
        })
        toast.success('Nota criada')
      }
      setShowForm(false)
      fetchNotes()
    } catch {
      toast.error('Erro ao guardar nota')
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (note: PersonalNote) => {
    try {
      await fetch(`/api/conexus/personal-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !note.done }),
      })
      fetchNotes()
    } catch {
      toast.error('Erro ao atualizar nota')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta nota?')) return
    try {
      await fetch(`/api/conexus/personal-notes/${id}`, { method: 'DELETE' })
      toast.success('Nota eliminada')
      fetchNotes()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  if (!mounted) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">A carregar...</div></div>
  }

  const dateLabel = selectedDate
    ? format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })
    : ''

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const po: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
    return (po[a.priority] ?? 1) - (po[b.priority] ?? 1)
  })

  const doneCount = notes.filter(n => n.done).length
  const pendingCount = notes.filter(n => !n.done).length

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Agenda Pessoal
              </h1>
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">As suas notas e tarefas privadas</p>
          </div>
          <div className="flex items-center gap-2">
            <VoiceNoteButton
              onTranscription={async (text) => {
                try {
                  await fetch('/api/conexus/personal-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: text.trim(), date: selectedDate, priority: 'media', source: 'voice' }),
                  })
                  fetchNotes()
                } catch {
                  toast.error('Erro ao guardar nota de voz')
                }
              }}
              size="md"
            />
            <Button
              onClick={() => openForm()}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Nota
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Date Navigation - fixa no topo ao fazer scroll */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-center gap-2 sm:gap-4 bg-card rounded-xl p-3 sm:p-4 shadow-sm">
          <Button variant="outline" size="icon" onClick={goToPrevDay} className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-0 flex-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e?.target?.value ?? '')}
              className="bg-transparent text-center font-mono text-sm border-none outline-none cursor-pointer w-full"
            />
            <p className="text-xs sm:text-sm text-muted-foreground capitalize mt-1 truncate">{dateLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={goToNextDay} className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <FadeIn delay={0.15}>
        <div className="flex gap-3">
          <div className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 flex-1">
            <div className="bg-amber-500 text-white p-2.5 rounded-lg"><Circle className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold font-mono">{pendingCount}</p><p className="text-xs text-muted-foreground">Pendentes</p></div>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 flex-1">
            <div className="bg-emerald-600 text-white p-2.5 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold font-mono">{doneCount}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
          </div>
        </div>
      </FadeIn>

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : sortedNotes.length === 0 ? (
        <FadeIn>
          <div className="text-center py-16 bg-card rounded-xl shadow-sm">
            <Lock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma nota para este dia</p>
            <Button variant="outline" className="mt-4" onClick={() => openForm()}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar nota
            </Button>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          {sortedNotes.map((note, idx) => {
            const p = priorityConfig[note.priority] ?? priorityConfig.media
            return (
              <FadeIn key={note.id} delay={idx * 0.04}>
                <div
                  className={cn(
                    'bg-card rounded-xl shadow-sm flex overflow-hidden transition-all hover:shadow-md',
                    note.done && 'opacity-50',
                  )}
                >
                  <div className={cn('w-2.5 flex-shrink-0 rounded-l-xl', p.color)} />
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className={cn('font-bold text-base text-[#1e3a5f]', note.done && 'line-through')}>
                            {note.title}
                          </h3>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', p.bg, p.text)}>{p.label}</span>
                          {note.source === 'voice' && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600">
                              <Mic className="h-3 w-3" /> Voz
                            </span>
                          )}
                          {note.done && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Concluída</span>}
                        </div>
                        {note.content && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                        )}
                        {note.time && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {note.time}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 sm:gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost" size="icon-sm"
                          onClick={() => toggleDone(note)}
                          className={cn('h-8 w-8 sm:h-7 sm:w-7', note.done ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}
                          title={note.done ? 'Reabrir' : 'Concluir'}
                        >
                          {note.done ? <Circle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openForm(note)} className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:bg-muted" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(note.id)} className="h-8 w-8 sm:h-7 sm:w-7 text-destructive hover:bg-red-50" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={(val: boolean) => { if (!val) setShowForm(false) }}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {editingNote ? 'Editar Nota' : 'Nova Nota'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="noteTitle">Título *</Label>
                <Input id="noteTitle" value={formTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTitle(e?.target?.value ?? '')} placeholder="O que precisa de fazer?" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="noteContent">Detalhes</Label>
                <Textarea id="noteContent" value={formContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormContent(e?.target?.value ?? '')} placeholder="Notas adicionais..." rows={3} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="noteTime">Hora</Label>
                  <Input id="noteTime" type="time" value={formTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTime(e?.target?.value ?? '')} className="mt-1" />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <div className="flex gap-2 mt-1">
                    {(['alta', 'media', 'baixa'] as const).map(pv => {
                      const pc = priorityConfig[pv]
                      return (
                        <button key={pv} type="button" onClick={() => setFormPriority(pv)}
                          className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                            formPriority === pv ? `${pc.color} text-white border-transparent shadow-sm` : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >{pc.label}</button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button type="submit" disabled={saving || !formTitle?.trim()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                  <Save className="h-4 w-4 mr-1" /> {editingNote ? 'Guardar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
