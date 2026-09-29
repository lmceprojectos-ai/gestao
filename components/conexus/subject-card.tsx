'use client'

import { CheckCircle2, ArrowRight, Pencil, Trash2, Clock, User, Briefcase, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CATEGORIES, REMINDER_STATUSES, CONTACT_TYPES, type SubjectType, type CategoryType, type ReminderStatusType } from '@/lib/conexus/types'
import { cn } from '@/lib/utils'

const priorityConfig: Record<string, { label: string; bg: string; text: string; borderColor: string; postItBg: string; hex: string }> = {
  alta: { label: 'Alta', bg: 'bg-red-50', text: 'text-red-700', borderColor: 'bg-red-500', postItBg: 'bg-red-100', hex: '#ef4444' },
  media: { label: 'Média', bg: 'bg-amber-50', text: 'text-amber-700', borderColor: 'bg-amber-400', postItBg: 'bg-amber-100', hex: '#f59e0b' },
  baixa: { label: 'Baixa', bg: 'bg-emerald-50', text: 'text-emerald-700', borderColor: 'bg-emerald-500', postItBg: 'bg-emerald-100', hex: '#10b981' },
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pendente: { label: 'Pendente', bg: 'bg-amber-50', text: 'text-amber-700' },
  tratado: { label: 'Tratado', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  passado: { label: 'Passado', bg: 'bg-slate-100', text: 'text-slate-600' },
}

interface SubjectCardProps {
  subject: SubjectType
  onMarkTreated: () => void
  onPass: () => void
  onEdit: () => void
  onDelete: () => void
  viewMode?: 'list' | 'postit'
  dynamicCategories?: CategoryType[]
  dynamicReminderStatuses?: ReminderStatusType[]
}

export function SubjectCard({ subject, onMarkTreated, onPass, onEdit, onDelete, viewMode = 'list', dynamicCategories, dynamicReminderStatuses }: SubjectCardProps) {
  const priority = priorityConfig[subject?.priority ?? 'media'] ?? priorityConfig.media
  const status = statusConfig[subject?.status ?? 'pendente'] ?? statusConfig.pendente
  const isTreated = subject?.status === 'tratado'
  const isPassed = subject?.status === 'passado'

  // Use dynamic categories if available, else fallback
  const catList = dynamicCategories && dynamicCategories.length > 0 ? dynamicCategories : CATEGORIES.map((c, i) => ({ id: c.value, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: i, active: true, visibleOnDashboard: true }))
  const cat = catList.find(c => c.value === subject?.category) ?? catList[catList.length - 1]

  const remList = dynamicReminderStatuses && dynamicReminderStatuses.length > 0 ? dynamicReminderStatuses : REMINDER_STATUSES.map((r, i) => ({ id: r.value, value: r.value, label: r.label, icon: r.icon, color: r.color, sortOrder: i, active: true }))
  const remStatus = remList.find(r => r.value === subject?.reminderStatus) ?? remList[0]

  const contactTypeInfo = CONTACT_TYPES.find(ct => ct.value === subject?.contactType)

  const deadlineStr = subject?.deadline
    ? new Date(subject.deadline).toLocaleDateString('pt-PT', { timeZone: 'UTC' })
    : null

  const reminderStr = subject?.reminderDate
    ? new Date(subject.reminderDate).toLocaleDateString('pt-PT', { timeZone: 'UTC' }) +
      ' às ' +
      new Date(subject.reminderDate).toLocaleTimeString('pt-PT', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
    : null

  const collabColor = subject?.collaborator?.color || '#1e3a5f'
  const collabName = subject?.collaborator?.name
  const collabInitial = collabName?.charAt?.(0)?.toUpperCase?.() ?? '?'

  if (viewMode === 'postit') {
    return (
      <div
        className={cn(
          'rounded-xl shadow-md p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between relative overflow-hidden cursor-pointer',
          isTreated && 'opacity-50',
        )}
        style={{ backgroundColor: `${collabColor}18`, borderTop: `4px solid ${collabColor}` }}
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEdit?.() }}
      >
        {/* Collaborator badge */}
        {collabName && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: collabColor }}
            >
              {collabInitial}
            </div>
            <span className="text-[10px] font-medium truncate" style={{ color: collabColor }}>{collabName}</span>
          </div>
        )}

        <div>
          <h3 className={cn('font-bold text-sm text-[#1e3a5f] leading-tight line-clamp-1', isTreated && 'line-through')}>
            {subject?.client || subject?.title || 'Sem título'}
          </h3>
          {subject?.client && subject?.title && (
            <p className={cn('text-xs text-foreground/70 mt-0.5 line-clamp-1', isTreated && 'line-through')}>
              {subject.title}
            </p>
          )}
        </div>

        {/* Priority dot + status */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priority.borderColor)} />
          <span className="text-[10px] text-muted-foreground">{priority.label}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{status.label}</span>
        </div>

        {/* Actions */}
        {!isTreated && !isPassed && (
          <div className="flex items-center justify-end gap-1 mt-1.5 pt-1.5 border-t border-black/5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" onClick={onMarkTreated} className="text-emerald-700 hover:bg-emerald-200/50 h-7 w-7 sm:h-6 sm:w-6" title="Tratado">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onPass} className="text-blue-700 hover:bg-blue-200/50 h-7 w-7 sm:h-6 sm:w-6" title="Passar">
              <ArrowRight className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete} className="text-red-700 hover:bg-red-200/50 h-7 w-7 sm:h-6 sm:w-6" title="Eliminar">
              <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // List view (default)
  return (
    <div
      className={cn(
        'bg-card rounded-xl shadow-sm flex overflow-hidden transition-all hover:shadow-md',
        isTreated && 'opacity-60',
      )}
    >
      {/* Collaborator color bar */}
      <div className="w-2.5 flex-shrink-0 rounded-l-xl" style={{ backgroundColor: collabColor }} />

      <div className="flex-1 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {subject?.client ? (
                <h3 className={cn('font-bold text-base text-[#1e3a5f]', isTreated && 'line-through')}>
                  {subject.client}
                </h3>
              ) : (
                <h3 className={cn('font-bold text-base text-[#1e3a5f]', isTreated && 'line-through')}>
                  {subject?.title ?? 'Sem título'}
                </h3>
              )}
              {subject?.scope === 'pessoal' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">
                  👤 Pessoal
                </span>
              )}
              {contactTypeInfo && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                  {contactTypeInfo.icon} {contactTypeInfo.label}
                </span>
              )}
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priority.bg, priority.text)}>
                {priority.label}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', status.bg, status.text)}>
                {status.label}
              </span>
            </div>
            {subject?.client && subject?.title && (
              <p className={cn('text-sm font-medium text-foreground/80 mt-0.5', isTreated && 'line-through')}>
                {subject.title}
              </p>
            )}
            {subject?.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subject.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {collabName && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full text-white flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: collabColor }}
                  >
                    {collabInitial}
                  </span>
                  {collabName}
                </span>
              )}
              {deadlineStr && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Prazo: {deadlineStr}</span>
              )}
              {reminderStr && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Lembrete: {reminderStr}</span>
              )}
              {subject?.workType && (
                <span className="flex items-center gap-1">💼 {subject.workType}</span>
              )}
              {subject?.reminderStatus && subject.reminderStatus !== 'nao_definido' && remStatus && (
                <span className={cn('flex items-center gap-1', remStatus.color)}>
                  {remStatus.icon} {remStatus.label}
                </span>
              )}
            </div>
            {subject?.passedReason && (
              <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 rounded px-2 py-1">
                Motivo: {subject.passedReason}
              </p>
            )}
          </div>

          {/* Actions */}
          {!isTreated && !isPassed && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onMarkTreated}
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                title="Marcar como tratado"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onPass}
                className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                title="Passar para outro dia"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                className="text-muted-foreground hover:bg-muted"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                className="text-destructive hover:bg-red-50"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
