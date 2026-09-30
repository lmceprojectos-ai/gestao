'use client'

import { useState, useEffect, useCallback } from 'react'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { hasGestaoAccess } from '@/lib/ponto/roles'
import { format, addDays, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, ClipboardList, CheckCircle2, Clock, ArrowRight, ChevronDown, User, Users, StickyNote, Circle, Check, Eye, EyeOff, Settings2, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectFormModal } from '@/components/conexus/subject-form-modal'
import { toast } from 'sonner'
import { CATEGORIES, type SubjectType, type CollaboratorType, type DaySummary, type CategoryType, type ReminderStatusType } from '@/lib/conexus/types'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/ui/animate'
import { VoiceNoteButton } from '@/components/conexus/voice-note-button'

import { KanbanBoard } from '@/components/conexus/kanban-board'

export function DashboardClient() {
  const searchParams = useSearchParams()
  // Quem não tem acesso à Gestão (ex.: só Ponto) volta ao Ponto
  const { data: session } = useSession() || {}
  const temGestao = hasGestaoAccess((session?.user as any)?.role ?? '')
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [subjects, setSubjects] = useState<SubjectType[]>([])
  const [collaborators, setCollaborators] = useState<CollaboratorType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectType | null>(null)

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)
  const [dynamicCategories, setDynamicCategories] = useState<CategoryType[]>([])
  const [dynamicReminderStatuses, setDynamicReminderStatuses] = useState<ReminderStatusType[]>([])

  useEffect(() => {
    setMounted(true)
    const dateParam = searchParams?.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam)
    } else {
      const today = new Date()
      setSelectedDate(format(today, 'yyyy-MM-dd'))
    }
  }, [searchParams])

  // Fetch dynamic categories & reminder statuses
  useEffect(() => {
    fetch('/api/conexus/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setDynamicCategories(data)
      })
      .catch(() => {})

    fetch('/api/conexus/reminder-statuses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setDynamicReminderStatuses(data)
      })
      .catch(() => {})
  }, [])

  const categories = dynamicCategories.length > 0
    ? dynamicCategories
    : CATEGORIES.map((c, i) => ({ id: c.value, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: i, active: true, visibleOnDashboard: true }))

  const fetchSubjects = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conexus/subjects?date=${selectedDate}`)
      const data = await res.json()
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error('Erro ao buscar assuntos:', err)
      toast.error('Erro ao carregar assuntos')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/collaborators')
      const data = await res.json()
      setCollaborators(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error('Erro ao buscar colaboradores:', err)
    }
  }, [])

  const handleCategoryChange = useCallback(async (subjectId: string, newCategory: string, oldCategory: string) => {
    setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, category: newCategory } : s))
    try {
      const res = await fetch(`/api/conexus/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      })
      if (!res.ok) throw new Error('Erro')
      const catLabel = categories.find(c => c.value === newCategory)?.label || newCategory
      const subject = subjects.find(s => s.id === subjectId)
      toast.success(`📋 Movido para ${catLabel}`, { description: subject?.title || '' })
    } catch {
      setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, category: oldCategory } : s))
      toast.error('Erro ao mover assunto')
    }
  }, [])

  useEffect(() => {
    if (mounted && selectedDate) {
      fetchSubjects()
      fetchCollaborators()
    }
  }, [mounted, selectedDate, fetchSubjects, fetchCollaborators])

  const summary: DaySummary = {
    total: subjects?.length ?? 0,
    treated: (subjects ?? []).filter((s: SubjectType) => s?.status === 'tratado')?.length ?? 0,
    pending: (subjects ?? []).filter((s: SubjectType) => s?.status === 'pendente')?.length ?? 0,
    passed: (subjects ?? []).filter((s: SubjectType) => s?.status === 'passado')?.length ?? 0,
  }

  const goToPrevDay = () => {
    if (!selectedDate) return
    const prev = subDays(new Date(selectedDate + 'T00:00:00'), 1)
    setSelectedDate(format(prev, 'yyyy-MM-dd'))
  }
  const goToNextDay = () => {
    if (!selectedDate) return
    const next = addDays(new Date(selectedDate + 'T00:00:00'), 1)
    setSelectedDate(format(next, 'yyyy-MM-dd'))
  }

  const handleMarkTreated = async (id: string) => {
    const subject = subjects.find(s => s.id === id)
    try {
      await fetch(`/api/conexus/subjects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'tratado' }),
      })
      toast.success('✅ Estado alterado: Tratado', { description: subject?.title || 'Assunto atualizado' })
      fetchSubjects()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao marcar como tratado')
    }
  }

  const handleDelete = async (id: string) => {
    const subject = subjects.find(s => s.id === id)
    if (!confirm('Tem a certeza que deseja eliminar este assunto?')) return
    try {
      await fetch(`/api/conexus/subjects/${id}`, { method: 'DELETE' })
      toast.success('🗑️ Assunto eliminado', { description: subject?.title || '' })
      fetchSubjects()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao eliminar assunto')
    }
  }

  const handlePassDirect = async (subject: SubjectType) => {
    try {
      await fetch('/api/conexus/subjects/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject.id, reason: 'Adiado' }),
      })
      toast.success('📅 Adiado para amanhã', { description: subject.title || subject.client })
      fetchSubjects()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao adiar assunto')
    }
  }

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingSubject) {
        await fetch(`/api/conexus/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        // Detailed toast: check what changed
        const collabChanged = data.collaboratorId !== editingSubject.collaboratorId
        const catChanged = data.category !== editingSubject.category
        const collabName = data.collaboratorId ? collaborators.find(c => c.id === data.collaboratorId)?.name : null
        const catLabel = categories.find(c => c.value === data.category)?.label

        if (collabChanged && collabName) {
          toast.success(`Tarefa atribuída a ${collabName}`, { description: data.title || editingSubject.title })
        } else if (catChanged && catLabel) {
          toast.success(`Movido para ${catLabel}`, { description: data.title || editingSubject.title })
        } else {
          toast.success('Assunto atualizado', { description: data.title || editingSubject.title })
        }
      } else {
        // Novos assuntos são sempre criados no dia de hoje
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        await fetch('/api/conexus/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, date: todayStr }),
        })
        const collabName = data.collaboratorId ? collaborators.find(c => c.id === data.collaboratorId)?.name : null
        if (collabName) {
          toast.success(`Tarefa criada e atribuída a ${collabName}`, { description: data.title })
        } else {
          toast.success('Assunto criado', { description: data.title })
        }
      }
      setShowForm(false)
      setEditingSubject(null)
      fetchSubjects()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao guardar assunto')
    }
  }

  if (!mounted) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">A carregar...</div></div>
  }

  const dateLabel = selectedDate
    ? format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })
    : ''

  // Sort subjects: urgent first, then by date (oldest first), then by priority
  const sortedSubjects = [...(subjects ?? [])].sort((a: SubjectType, b: SubjectType) => {
    const statusOrder: Record<string, number> = { pendente: 0, passado: 1, tratado: 2 }
    const sa = statusOrder[a?.status ?? 'pendente'] ?? 1
    const sb = statusOrder[b?.status ?? 'pendente'] ?? 1
    if (sa !== sb) return sa - sb
    // Urgent first
    if (a.urgent && !b.urgent) return -1
    if (!a.urgent && b.urgent) return 1
    // Important second
    if (a.important && !b.important) return -1
    if (!a.important && b.important) return 1
    // Then by date
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
    if (da !== db) return da - db
    // Then by priority
    const priorityOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
    const pa = priorityOrder[a?.priority ?? 'media'] ?? 1
    const pb = priorityOrder[b?.priority ?? 'media'] ?? 1
    return pa - pb
  })

  // Group by category, sorted alphabetically — only show categories visible on dashboard
  const groupedByCategory = [...categories]
    .filter(cat => cat.visibleOnDashboard !== false)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt'))
    .map(cat => ({
      ...cat,
      subjects: sortedSubjects.filter((s: SubjectType) => s?.category === cat.value),
    }))

  const toggleCategoryVisibility = async (catId: string, currentlyVisible: boolean) => {
    const newVisible = !currentlyVisible
    // Optimistic update
    setDynamicCategories(prev => prev.map(c => c.id === catId ? { ...c, visibleOnDashboard: newVisible } : c))
    try {
      const res = await fetch(`/api/conexus/categories/${catId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleOnDashboard: newVisible }),
      })
      if (!res.ok) throw new Error('Erro')
      const catLabel = categories.find(c => c.id === catId)?.label || ''
      toast.success(newVisible ? `${catLabel} visível no dashboard` : `${catLabel} oculta do dashboard`)
    } catch {
      setDynamicCategories(prev => prev.map(c => c.id === catId ? { ...c, visibleOnDashboard: currentlyVisible } : c))
      toast.error('Erro ao alterar visibilidade')
    }
  }

  const toggleCategoryCollapse = (catValue: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catValue)) next.delete(catValue)
      else next.add(catValue)
      return next
    })
  }

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Conexus
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão diária de assuntos e tarefas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="shadow-sm">
              <Link href={temGestao ? '/' : '/ponto/colaborador'}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {temGestao ? 'Voltar à Gestão' : 'Voltar ao Ponto'}
              </Link>
            </Button>
            <Button
              onClick={() => { setEditingSubject(null); setShowForm(true) }}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Assunto
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

      {/* Summary Cards */}
      <FadeIn delay={0.2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={ClipboardList} label="Total" value={summary.total} color="bg-[#1e3a5f]" />
          <SummaryCard icon={CheckCircle2} label="Tratados" value={summary.treated} color="bg-emerald-600" />
          <SummaryCard icon={Clock} label="Pendentes" value={summary.pending} color="bg-amber-500" />
          <SummaryCard icon={ArrowRight} label="Passados" value={summary.passed} color="bg-slate-500" />
        </div>
      </FadeIn>

      {/* Agenda Pessoal */}
      <FadeIn delay={0.22}>
        <PersonalNotesWidget selectedDate={selectedDate} />
      </FadeIn>

      {/* Collaborator Overview */}
      <FadeIn delay={0.25}>
        <CollaboratorOverview subjects={sortedSubjects} collaborators={collaborators} />
      </FadeIn>

      {/* Category visibility controls + Kanban */}
      <FadeIn delay={0.3}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base text-foreground">Quadro de Assuntos</h2>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVisibilityPanel(!showVisibilityPanel)}
              className="gap-1.5 text-xs"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Categorias
            </Button>
            {showVisibilityPanel && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowVisibilityPanel(false)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-card border border-border rounded-xl shadow-lg p-3 min-w-[220px]">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Visibilidade no Dashboard</p>
                  <div className="space-y-1">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategoryVisibility(cat.id, cat.visibleOnDashboard !== false)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {cat.visibleOnDashboard !== false ? (
                          <Eye className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm">{cat.icon}</span>
                        <span className={cn('text-sm flex-1 truncate', cat.visibleOnDashboard === false && 'text-muted-foreground line-through')}>
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </FadeIn>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar assuntos...</div>
      ) : sortedSubjects.length === 0 ? (
        <FadeIn>
          <div className="text-center py-16 bg-card rounded-xl shadow-sm">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum assunto para este dia</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { setEditingSubject(null); setShowForm(true) }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar assunto
            </Button>
          </div>
        </FadeIn>
      ) : (
        <KanbanBoard
          groupedByCategory={groupedByCategory}
          collapsedCategories={collapsedCategories}
          toggleCategoryCollapse={toggleCategoryCollapse}
          dynamicCategories={dynamicCategories}
          dynamicReminderStatuses={dynamicReminderStatuses}
          onMarkTreated={handleMarkTreated}
          onPass={(s) => handlePassDirect(s)}
          onEdit={(s) => { setEditingSubject(s); setShowForm(true) }}
          onDelete={handleDelete}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {/* Modals */}
      {showForm && (
        <SubjectFormModal
          open={showForm}
          onClose={() => { setShowForm(false); setEditingSubject(null) }}
          onSubmit={handleFormSubmit}
          collaborators={collaborators}
          editingSubject={editingSubject}
        />
      )}


    </div>
  )
}

function CollaboratorOverview({ subjects, collaborators }: { subjects: SubjectType[]; collaborators: CollaboratorType[] }) {
  // Group subjects by collaborator
  const unassigned = subjects.filter(s => !s.collaboratorId)
  const collabGroups = collaborators.map(c => ({
    collaborator: c,
    subjects: subjects.filter(s => s.collaboratorId === c.id),
  }))

  // Only show if there are collaborators
  if (collaborators.length === 0 && unassigned.length === 0) return null

  const statusDot = (status: string) => {
    if (status === 'tratado') return 'bg-emerald-500'
    if (status === 'passado') return 'bg-slate-400'
    return 'bg-amber-400'
  }

  const priorityBorder = (priority: string) => {
    if (priority === 'alta') return 'border-l-red-500'
    if (priority === 'baixa') return 'border-l-emerald-500'
    return 'border-l-amber-400'
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-[#1e3a5f]" />
        <h2 className="font-semibold text-base text-foreground">Visão por Operador</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collabGroups.map(({ collaborator, subjects: cSubjects }) => {
          const pending = cSubjects.filter(s => s.status === 'pendente').length
          const treated = cSubjects.filter(s => s.status === 'tratado').length
          const total = cSubjects.length
          return (
            <div key={collaborator.id} className="rounded-xl overflow-hidden shadow-sm" style={{ borderTop: `4px solid ${collaborator.color || '#1e3a5f'}`, backgroundColor: `${collaborator.color || '#1e3a5f'}08` }}>
              <div className="flex items-center gap-3 p-3 pb-2">
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center text-base font-bold shadow-sm" style={{ backgroundColor: collaborator.color || '#1e3a5f' }}>
                  {collaborator.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{collaborator.name}</p>
                  {collaborator.role && <p className="text-[10px] text-muted-foreground">{collaborator.role}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {pending > 0 && <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${collaborator.color || '#1e3a5f'}15`, color: collaborator.color || '#1e3a5f' }}>{pending} pend.</span>}
                  {treated > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{treated} trat.</span>}
                </div>
              </div>
              {total === 0 ? (
                <p className="text-xs text-muted-foreground italic px-3 pb-3">Sem tarefas atribuídas</p>
              ) : (
                <div className="space-y-1 px-3 pb-3">
                  {cSubjects.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md" style={{ borderLeft: `3px solid ${collaborator.color || '#1e3a5f'}` }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: collaborator.color || '#1e3a5f' }} />
                      <span className={cn('truncate flex-1', s.status === 'tratado' && 'line-through text-muted-foreground')}>
                        {s.client || s.title}
                      </span>
                    </div>
                  ))}
                  {total > 5 && <p className="text-[10px] text-muted-foreground pl-2">+{total - 5} mais</p>}
                </div>
              )}
            </div>
          )
        })}
        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div className="border border-dashed border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold">?</div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground">Sem atribuição</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{unassigned.length}</span>
            </div>
            <div className="space-y-1">
              {unassigned.slice(0, 5).map(s => (
                <div key={s.id} className={cn('flex items-center gap-2 text-xs py-1 px-2 rounded border-l-2', priorityBorder(s.priority))}>
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDot(s.status))} />
                  <span className={cn('truncate flex-1', s.status === 'tratado' && 'line-through text-muted-foreground')}>
                    {s.client || s.title}
                  </span>
                </div>
              ))}
              {unassigned.length > 5 && <p className="text-[10px] text-muted-foreground pl-2">+{unassigned.length - 5} mais</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface PersonalNote {
  id: string
  title: string
  content: string
  date: string
  time: string | null
  priority: string
  done: boolean
  source?: string
}

function PersonalNotesWidget({ selectedDate }: { selectedDate: string }) {
  const [notes, setNotes] = useState<PersonalNote[]>([])
  const [loading, setLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchNotes = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conexus/personal-notes?date=${selectedDate}`)
      const data = await res.json()
      setNotes(Array.isArray(data) ? data : [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleAdd = async () => {
    if (!newNote.trim()) return
    setAdding(true)
    try {
      await fetch('/api/conexus/personal-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newNote.trim(), date: selectedDate, priority: 'media' }),
      })
      setNewNote('')
      fetchNotes()
    } catch {
      toast.error('Erro ao adicionar nota')
    } finally {
      setAdding(false)
    }
  }

  const handleVoiceNote = async (text: string) => {
    if (!text.trim()) return
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
  }

  const toggleDone = async (note: PersonalNote) => {
    try {
      await fetch(`/api/conexus/personal-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !note.done }),
      })
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, done: !n.done } : n))
    } catch {
      toast.error('Erro ao atualizar nota')
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await fetch(`/api/conexus/personal-notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      toast.error('Erro ao eliminar nota')
    }
  }

  const priorityDot = (p: string) => {
    if (p === 'alta') return 'bg-red-500'
    if (p === 'baixa') return 'bg-emerald-500'
    return 'bg-amber-400'
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-base text-foreground">Agenda Pessoal</h2>
          {notes.length > 0 && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {notes.filter(n => !n.done).length} pendente{notes.filter(n => !n.done).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <a href="/conexus/agenda-pessoal" className="text-xs text-[#1e3a5f] hover:underline font-medium">Ver tudo →</a>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Adicionar nota rápida..."
          className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
        />
        <VoiceNoteButton
          onTranscription={(text) => {
            handleVoiceNote(text)
          }}
          size="sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !newNote.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white h-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 text-center py-4">Sem notas pessoais para este dia</p>
      ) : (
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                'flex items-center gap-2 py-2 px-3 rounded-lg transition-colors group',
                note.done ? 'bg-muted/50' : 'hover:bg-muted/30'
              )}
            >
              <button onClick={() => toggleDone(note)} className="flex-shrink-0 p-1 -m-1 touch-manipulation">
                {note.done ? (
                  <Check className="h-5 w-5 sm:h-4 sm:w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground/40 hover:text-purple-500 transition-colors" />
                )}
              </button>
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityDot(note.priority))} />
              {note.source === 'voice' && <Mic className="h-3 w-3 text-purple-400 flex-shrink-0" />}
              <span className={cn(
                'text-sm flex-1 truncate',
                note.done && 'line-through text-muted-foreground'
              )}>
                {note.title}
              </span>
              {note.time && <span className="text-[10px] text-muted-foreground">{note.time}</span>}
              <button
                onClick={() => deleteNote(note.id)}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all text-xs p-1 -m-1 touch-manipulation"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className={`${color} text-white p-2.5 rounded-lg`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono">{value ?? 0}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
