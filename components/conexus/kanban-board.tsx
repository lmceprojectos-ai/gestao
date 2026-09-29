'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { SubjectCard } from '@/components/conexus/subject-card'
import { cn } from '@/lib/utils'
import type { SubjectType, CategoryType, ReminderStatusType } from '@/lib/conexus/types'

interface KanbanBoardProps {
  groupedByCategory: Array<{
    value: string
    label: string
    icon: string
    color: string
    subjects: SubjectType[]
  }>
  collapsedCategories: Set<string>
  toggleCategoryCollapse: (catValue: string) => void
  dynamicCategories: CategoryType[]
  dynamicReminderStatuses: ReminderStatusType[]
  onMarkTreated: (id: string) => void
  onPass: (subject: SubjectType) => void
  onEdit: (subject: SubjectType) => void
  onDelete: (id: string) => void
  onCategoryChange: (subjectId: string, newCategory: string, oldCategory: string) => void
}

export function KanbanBoard({
  groupedByCategory,
  collapsedCategories,
  toggleCategoryCollapse,
  dynamicCategories,
  dynamicReminderStatuses,
  onMarkTreated,
  onPass,
  onEdit,
  onDelete,
  onCategoryChange,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, subjectId: string, fromCategory: string) => {
    setDraggingId(subjectId)
    setDraggingFrom(fromCategory)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', subjectId)
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingId(null)
    setDraggingFrom(null)
    setDragOverColumn(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnValue: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnValue)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the droppable area entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverColumn(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toCategory: string) => {
    e.preventDefault()
    const subjectId = e.dataTransfer.getData('text/plain')
    if (subjectId && draggingFrom && draggingFrom !== toCategory) {
      onCategoryChange(subjectId, toCategory, draggingFrom)
    }
    setDraggingId(null)
    setDraggingFrom(null)
    setDragOverColumn(null)
  }, [draggingFrom, onCategoryChange])

  const columnCount = groupedByCategory.length

  return (
    <div className="pb-4">
      <div
        className="grid gap-3 sm:gap-4"
        style={{
          gridTemplateColumns: isDesktop
            ? (columnCount <= 4
              ? `repeat(${columnCount}, 1fr)`
              : `repeat(${columnCount}, minmax(220px, 1fr))`)
            : '1fr',
          overflowX: isDesktop && columnCount > 4 ? 'auto' : undefined,
        }}
      >
        {groupedByCategory.map((group) => (
          <div key={group.value} className="min-w-0">
            {/* Category header */}
            <button
              onClick={() => toggleCategoryCollapse(group.value)}
              className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-card shadow-sm hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', group.color)} />
                <span className="text-sm flex-shrink-0">{group.icon}</span>
                <h2 className="font-semibold text-sm text-foreground uppercase tracking-wide truncate">{group.label}</h2>
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {group.subjects.length}
                </span>
              </div>
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', collapsedCategories.has(group.value) && '-rotate-90')} />
            </button>

            {/* Droppable area */}
            {!collapsedCategories.has(group.value) && (
              <div
                onDragOver={(e) => handleDragOver(e, group.value)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, group.value)}
                className={cn(
                  'flex flex-col gap-3 min-h-[60px] rounded-lg p-1 transition-all',
                  dragOverColumn === group.value && draggingFrom !== group.value && 'bg-muted/40 ring-2 ring-[#f97316]/30'
                )}
              >
                {group.subjects.map((subject: SubjectType, index: number) => (
                  <div
                    key={subject?.id ?? index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, subject?.id ?? '', group.value)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'cursor-grab active:cursor-grabbing transition-transform',
                      draggingId === subject?.id && 'opacity-50 scale-95 rotate-1'
                    )}
                  >
                    <SubjectCard
                      subject={subject}
                      viewMode={'postit'}
                      dynamicCategories={dynamicCategories}
                      dynamicReminderStatuses={dynamicReminderStatuses}
                      onMarkTreated={() => onMarkTreated(subject?.id ?? '')}
                      onPass={() => onPass(subject)}
                      onEdit={() => onEdit(subject)}
                      onDelete={() => onDelete(subject?.id ?? '')}
                    />
                  </div>
                ))}

                {/* Empty state placeholder */}
                {group.subjects.length === 0 && (
                  <div className={cn(
                    'text-center py-4 text-xs text-muted-foreground border-2 border-dashed border-muted rounded-lg',
                    dragOverColumn === group.value && 'border-[#f97316]/40 bg-[#f97316]/5'
                  )}>
                    Arraste para aqui
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

