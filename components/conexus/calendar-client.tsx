'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CATEGORIES, type SubjectType, type CategoryType } from '@/lib/conexus/types'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/ui/animate'
import { useRouter } from 'next/navigation'

type ViewMode = 'semana' | 'mes'

const priorityDot: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-400',
  baixa: 'bg-emerald-500',
}

const statusBg: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  tratado: 'bg-emerald-100 text-emerald-800 line-through opacity-60',
  passado: 'bg-slate-100 text-slate-600',
}

export function CalendarClient() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('mes')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [subjects, setSubjects] = useState<SubjectType[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CategoryType[]>([])

  useEffect(() => {
    setMounted(true)
    fetch('/api/conexus/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setCategories(data)
      })
      .catch(() => {})
  }, [])

  const getDateRange = useCallback(() => {
    if (viewMode === 'semana') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return { start, end }
    } else {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const start = startOfWeek(monthStart, { weekStartsOn: 1 })
      const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
      return { start, end }
    }
  }, [viewMode, currentDate])

  const fetchSubjects = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')
      const res = await fetch(`/api/conexus/subjects?startDate=${startStr}&endDate=${endStr}`)
      const data = await res.json()
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error('Erro ao buscar assuntos:', err)
      toast.error('Erro ao carregar assuntos')
    } finally {
      setLoading(false)
    }
  }, [getDateRange])

  useEffect(() => {
    if (mounted) fetchSubjects()
  }, [mounted, fetchSubjects])

  const goToPrev = () => {
    if (viewMode === 'semana') setCurrentDate(prev => subWeeks(prev, 1))
    else setCurrentDate(prev => subMonths(prev, 1))
  }

  const goToNext = () => {
    if (viewMode === 'semana') setCurrentDate(prev => addWeeks(prev, 1))
    else setCurrentDate(prev => addMonths(prev, 1))
  }

  const goToToday = () => setCurrentDate(new Date())

  const navigateToDay = (date: Date) => {
    // Navigate to dashboard with the selected date as a query param
    const dateStr = format(date, 'yyyy-MM-dd')
    router.push(`/conexus?date=${dateStr}`)
  }

  if (!mounted) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">A carregar...</div></div>
  }

  const { start, end } = getDateRange()
  const days = eachDayOfInterval({ start, end })
  const today = new Date()
  const catList = categories.length > 0
    ? categories
    : CATEGORIES.map((c, i) => ({ id: c.value, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: i, active: true, visibleOnDashboard: true }))

  const getSubjectsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return subjects.filter(s => s?.date === dayStr)
  }

  const weekDayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  const headerLabel = viewMode === 'semana'
    ? `${format(start, "d 'de' MMM", { locale: pt })} – ${format(end, "d 'de' MMM yyyy", { locale: pt })}`
    : format(currentDate, "MMMM 'de' yyyy", { locale: pt })

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Calendário
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Vista geral dos assuntos por data</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('semana')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'semana' ? 'bg-card shadow-sm text-[#1e3a5f]' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Semana
              </button>
              <button
                onClick={() => setViewMode('mes')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'mes' ? 'bg-card shadow-sm text-[#1e3a5f]' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Mês
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Navigation */}
      <FadeIn delay={0.1}>
        <div className="flex items-center justify-center gap-4 bg-card rounded-xl p-4 shadow-sm">
          <Button variant="outline" size="icon" onClick={goToPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-0 flex-1">
            <p className="text-lg font-semibold text-foreground capitalize">{headerLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </FadeIn>

      {/* Calendar Grid */}
      <FadeIn delay={0.2}>
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDayNames.map((name) => (
              <div key={name} className="text-center py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {name}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const daySubjects = getSubjectsForDay(day)
              const isToday = isSameDay(day, today)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const pendingCount = daySubjects.filter(s => s.status === 'pendente').length
              const treatedCount = daySubjects.filter(s => s.status === 'tratado').length

              return (
                <div
                  key={idx}
                  onClick={() => navigateToDay(day)}
                  className={cn(
                    'min-h-[100px] sm:min-h-[120px] border-b border-r border-border p-1.5 sm:p-2 cursor-pointer transition-colors hover:bg-muted/50',
                    !isCurrentMonth && viewMode === 'mes' && 'bg-muted/30',
                    isToday && 'bg-blue-50/50',
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                        isToday && 'bg-[#f97316] text-white',
                        !isCurrentMonth && viewMode === 'mes' && 'text-muted-foreground/50',
                        isCurrentMonth && !isToday && 'text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {daySubjects.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {daySubjects.length}
                      </span>
                    )}
                  </div>

                  {/* Subject chips */}
                  <div className="space-y-0.5">
                    {daySubjects.slice(0, viewMode === 'semana' ? 6 : 3).map((subject, sIdx) => {
                      const cat = catList.find(c => c.value === subject.category)
                      return (
                        <div
                          key={subject.id ?? sIdx}
                          className={cn(
                            'text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded truncate font-medium',
                            statusBg[subject.status ?? 'pendente'] ?? statusBg.pendente,
                          )}
                          title={`${subject.client || subject.title} - ${subject.status}`}
                        >
                          <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0', priorityDot[subject.priority ?? 'media'] ?? priorityDot.media)} />
                          {subject.client || subject.title || 'Sem título'}
                        </div>
                      )
                    })}
                    {daySubjects.length > (viewMode === 'semana' ? 6 : 3) && (
                      <div className="text-[10px] text-muted-foreground font-medium px-1">
                        +{daySubjects.length - (viewMode === 'semana' ? 6 : 3)} mais
                      </div>
                    )}
                  </div>

                  {/* Summary dots for month view when many items */}
                  {viewMode === 'mes' && daySubjects.length > 0 && daySubjects.length <= 3 && (
                    <div className="flex gap-0.5 mt-1">
                      {pendingCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${pendingCount} pendente(s)`} />}
                      {treatedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${treatedCount} tratado(s)`} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </FadeIn>

      {/* Legend */}
      <FadeIn delay={0.3}>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-card rounded-xl p-4 shadow-sm">
          <span className="font-medium text-foreground">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Alta
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Média
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Baixa
          </div>
          <div className="border-l border-border pl-4 flex items-center gap-3">
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Pendente</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Tratado</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Passado</span>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
