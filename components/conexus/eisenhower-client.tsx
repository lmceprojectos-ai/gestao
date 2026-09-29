'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, AlertTriangle, Clock, Users, Archive, GripVertical } from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SubjectType } from '@/lib/conexus/types'

const priorityConfig: Record<string, { hex: string }> = {
  alta: { hex: '#ef4444' },
  media: { hex: '#f59e0b' },
  baixa: { hex: '#10b981' },
}

const statusConfig: Record<string, { label: string; icon: string }> = {
  pendente: { label: 'Pendente', icon: '\uD83D\uDFE1' },
  tratado: { label: 'Tratado', icon: '\u2705' },
  passado: { label: 'Passado', icon: '\u27A1\uFE0F' },
}

interface Quadrant {
  key: string
  label: string
  description: string
  urgent: boolean
  important: boolean
  icon: React.ReactNode
  bgClass: string
  borderClass: string
  headerBg: string
  dropHighlight: string
}

const quadrants: Quadrant[] = [
  {
    key: 'do',
    label: '🚨 Fazer Agora',
    description: 'Urgente e Importante',
    urgent: true,
    important: true,
    icon: <AlertTriangle className="h-4 w-4" />,
    bgClass: 'bg-red-50/50',
    borderClass: 'border-red-200',
    headerBg: 'bg-red-500',
    dropHighlight: 'ring-4 ring-red-300 bg-red-100/80',
  },
  {
    key: 'schedule',
    label: '📅 Agendar',
    description: 'Importante, não urgente',
    urgent: false,
    important: true,
    icon: <Clock className="h-4 w-4" />,
    bgClass: 'bg-blue-50/50',
    borderClass: 'border-blue-200',
    headerBg: 'bg-blue-500',
    dropHighlight: 'ring-4 ring-blue-300 bg-blue-100/80',
  },
  {
    key: 'delegate',
    label: '👥 Delegar',
    description: 'Urgente, não importante',
    urgent: true,
    important: false,
    icon: <Users className="h-4 w-4" />,
    bgClass: 'bg-amber-50/50',
    borderClass: 'border-amber-200',
    headerBg: 'bg-amber-500',
    dropHighlight: 'ring-4 ring-amber-300 bg-amber-100/80',
  },
  {
    key: 'eliminate',
    label: '🗑️ Eliminar ou Adiar',
    description: 'Nem urgente nem importante',
    urgent: false,
    important: false,
    icon: <Archive className="h-4 w-4" />,
    bgClass: 'bg-gray-50/50',
    borderClass: 'border-gray-200',
    headerBg: 'bg-gray-400',
    dropHighlight: 'ring-4 ring-gray-300 bg-gray-200/80',
  },
]

function getQuadrantKey(subject: SubjectType): string {
  if (subject.urgent && subject.important) return 'do'
  if (!subject.urgent && subject.important) return 'schedule'
  if (subject.urgent && !subject.important) return 'delegate'
  return 'eliminate'
}

export function EisenhowerClient() {
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [subjects, setSubjects] = useState<SubjectType[]>([])
  const [loading, setLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const today = new Date()
    setSelectedDate(format(today, 'yyyy-MM-dd'))
  }, [])

  const fetchSubjects = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conexus/subjects?date=${selectedDate}`)
      const data = await res.json()
      setSubjects(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Erro ao carregar assuntos')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (mounted && selectedDate) fetchSubjects()
  }, [mounted, selectedDate, fetchSubjects])

  const navigateDate = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00')
    const newDate = dir === 'prev' ? subDays(d, 1) : addDays(d, 1)
    setSelectedDate(format(newDate, 'yyyy-MM-dd'))
  }

  const goToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))

  const toggleField = async (subject: SubjectType, field: 'urgent' | 'important') => {
    const newValue = !subject[field]
    try {
      await fetch(`/api/conexus/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      })
      setSubjects(prev =>
        prev.map(s => s.id === subject.id ? { ...s, [field]: newValue } : s)
      )
    } catch {
      toast.error('Erro ao atualizar assunto')
    }
  }

  const handleMarkTreated = async (id: string) => {
    try {
      await fetch(`/api/conexus/subjects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'tratado' }),
      })
      toast.success('Marcado como tratado')
      fetchSubjects()
    } catch {
      toast.error('Erro ao marcar como tratado')
    }
  }

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, subjectId: string) => {
    e.dataTransfer.setData('text/plain', subjectId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(subjectId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverQuadrant(null)
  }

  const handleDragOver = (e: React.DragEvent, quadrantKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverQuadrant !== quadrantKey) {
      setDragOverQuadrant(quadrantKey)
    }
  }

  const handleDragLeave = (e: React.DragEvent, quadrantKey: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      if (dragOverQuadrant === quadrantKey) {
        setDragOverQuadrant(null)
      }
    }
  }

  const handleDrop = async (e: React.DragEvent, targetQuadrant: Quadrant) => {
    e.preventDefault()
    setDragOverQuadrant(null)
    const subjectId = e.dataTransfer.getData('text/plain')
    if (!subjectId) return

    const subject = subjects.find(s => s.id === subjectId)
    if (!subject) return

    const currentKey = getQuadrantKey(subject)
    if (currentKey === targetQuadrant.key) {
      setDraggingId(null)
      return
    }

    // Optimistic update
    setSubjects(prev =>
      prev.map(s => s.id === subjectId
        ? { ...s, urgent: targetQuadrant.urgent, important: targetQuadrant.important }
        : s
      )
    )
    setDraggingId(null)

    try {
      await fetch(`/api/conexus/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgent: targetQuadrant.urgent, important: targetQuadrant.important }),
      })
      const quadLabel = targetQuadrant.label.replace(/^\S+\s/, '')
      toast.success(`Movido para "${quadLabel}"`)
    } catch {
      toast.error('Erro ao mover assunto')
      fetchSubjects()
    }
  }

  const grouped = subjects.reduce<Record<string, SubjectType[]>>((acc, s) => {
    const key = getQuadrantKey(s)
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  if (!mounted) return null

  const formattedDate = (() => {
    try {
      const d = new Date(selectedDate + 'T12:00:00')
      return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })
    } catch { return selectedDate }
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Matriz de Eisenhower</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize tarefas por urgência e importância — arraste entre quadrantes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateDate('prev')} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToday}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isToday ? 'bg-[#1e3a5f] text-white' : 'bg-muted hover:bg-muted/80'
            )}
          >
            <Calendar className="h-4 w-4" />
            <span className="capitalize">{formattedDate}</span>
          </button>
          <button onClick={() => navigateDate('next')} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Matrix Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">A carregar...</div>
        </div>
      ) : (
        <>
          {/* Axis labels */}
          <div className="relative">
            <div className="flex justify-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">← Importante →</span>
            </div>
            <div className="flex">
              <div className="flex items-center mr-2 -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">← Urgente →</span>
              </div>
              {/* 2x2 Grid */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {quadrants.map((q) => {
                  const items = grouped[q.key] || []
                  const pendingCount = items.filter(s => s.status === 'pendente').length
                  const isDropTarget = dragOverQuadrant === q.key
                  return (
                    <div
                      key={q.key}
                      onDragOver={(e) => handleDragOver(e, q.key)}
                      onDragLeave={(e) => handleDragLeave(e, q.key)}
                      onDrop={(e) => handleDrop(e, q)}
                      className={cn(
                        'rounded-xl border-2 overflow-hidden min-h-[200px] flex flex-col transition-all duration-200',
                        q.borderClass,
                        q.bgClass,
                        isDropTarget && q.dropHighlight,
                        isDropTarget && 'scale-[1.01]'
                      )}
                    >
                      {/* Quadrant header */}
                      <div className={cn('px-4 py-3 text-white flex items-center justify-between', q.headerBg)}>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold">{q.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {pendingCount > 0 && (
                            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                            {items.length} total
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground px-4 pt-2">{q.description}</p>

                      {/* Drop zone hint */}
                      {isDropTarget && items.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-8">
                          <span className="text-sm font-medium text-muted-foreground animate-pulse">Soltar aqui</span>
                        </div>
                      )}

                      {/* Items */}
                      <div className={cn('flex-1 p-3 space-y-2 overflow-y-auto max-h-[350px]', isDropTarget && items.length === 0 && 'hidden')}>
                        {items.length === 0 && !isDropTarget ? (
                          <div className="flex items-center justify-center h-full text-sm text-muted-foreground/50 py-8">
                            Sem assuntos
                          </div>
                        ) : (
                          items.map((subject) => {
                            const pHex = priorityConfig[subject.priority]?.hex ?? '#f59e0b'
                            const stCfg = statusConfig[subject.status] ?? statusConfig.pendente
                            const isTreated = subject.status === 'tratado'
                            const isDragging = draggingId === subject.id
                            return (
                              <div
                                key={subject.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, subject.id)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  'rounded-lg p-3 border transition-all group cursor-grab active:cursor-grabbing',
                                  isTreated ? 'opacity-60 bg-white/60' : 'bg-white shadow-sm hover:shadow-md',
                                  isDragging && 'opacity-30 scale-95 rotate-1'
                                )}
                                style={{ borderLeft: `4px solid ${pHex}` }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
                                    <GripVertical className="h-4 w-4 flex-shrink-0" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[11px]">{stCfg.icon}</span>
                                      {subject.client && (
                                        <span className="text-[11px] text-muted-foreground truncate">{subject.client}</span>
                                      )}
                                    </div>
                                    <p className={cn(
                                      'text-sm font-medium truncate',
                                      isTreated && 'line-through text-muted-foreground'
                                    )}>
                                      {subject.title}
                                    </p>
                                    {subject.collaborator && (
                                      <p className="text-[11px] text-muted-foreground mt-0.5">👤 {subject.collaborator.name}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => toggleField(subject, 'urgent')}
                                      title={subject.urgent ? 'Remover urgência' : 'Marcar urgente'}
                                      className={cn(
                                        'p-1 rounded text-xs transition-colors',
                                        subject.urgent ? 'bg-red-100 text-red-600' : 'hover:bg-red-50 text-muted-foreground'
                                      )}
                                    >
                                      🚨
                                    </button>
                                    <button
                                      onClick={() => toggleField(subject, 'important')}
                                      title={subject.important ? 'Remover importância' : 'Marcar importante'}
                                      className={cn(
                                        'p-1 rounded text-xs transition-colors',
                                        subject.important ? 'bg-blue-100 text-blue-600' : 'hover:bg-blue-50 text-muted-foreground'
                                      )}
                                    >
                                      ⭐
                                    </button>
                                    {!isTreated && (
                                      <button
                                        onClick={() => handleMarkTreated(subject.id)}
                                        title="Marcar como tratado"
                                        className="p-1 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Summary */}
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center text-sm text-muted-foreground">
              {quadrants.map((q) => {
                const count = (grouped[q.key] || []).length
                return (
                  <span key={q.key} className="flex items-center gap-1.5">
                    <span className={cn('w-3 h-3 rounded-sm', q.headerBg)} />
                    {q.label.split(' ').slice(1).join(' ')}: <strong>{count}</strong>
                  </span>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
