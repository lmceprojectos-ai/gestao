'use client'

import { useState, useEffect, useCallback } from 'react'
import { History, Filter, Calendar, User, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { SubjectType, CollaboratorType } from '@/lib/conexus/types'
import { FadeIn } from '@/components/ui/animate'

export function HistoryClient() {
  const [subjects, setSubjects] = useState<SubjectType[]>([])
  const [collaborators, setCollaborators] = useState<CollaboratorType[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCollaborator, setSelectedCollaborator] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/collaborators')
      const data = await res.json()
      setCollaborators(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchCollaborators()
  }, [fetchCollaborators])

  const search = async () => {
    setLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (selectedCollaborator) params.set('collaboratorId', selectedCollaborator)
      const res = await fetch(`/api/conexus/history?${params.toString()}`)
      const data = await res.json()
      setSubjects(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao buscar histórico')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Histórico</h1>
          <p className="text-sm text-muted-foreground mt-1">Assuntos passados para outro dia com respetivo motivo</p>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="bg-card rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-[#f97316]" />
            <h2 className="font-semibold">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom" className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" /> Data Início
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e?.target?.value ?? '')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dateTo" className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" /> Data Fim
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e?.target?.value ?? '')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collab-filter" className="flex items-center gap-1 text-xs">
                <User className="h-3 w-3" /> Colaborador
              </Label>
              <select
                id="collab-filter"
                value={selectedCollaborator}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCollaborator(e?.target?.value ?? '')}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {(collaborators ?? []).map((c: CollaboratorType) => (
                  <option key={c?.id} value={c?.id}>{c?.name ?? ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={search} className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white">
              <Filter className="h-4 w-4 mr-2" /> Pesquisar
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A pesquisar...</div>
      ) : !hasSearched ? (
        <FadeIn>
          <div className="text-center py-16 bg-card rounded-xl shadow-sm">
            <History className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Utilize os filtros acima para pesquisar o histórico</p>
          </div>
        </FadeIn>
      ) : (subjects?.length ?? 0) === 0 ? (
        <FadeIn>
          <div className="text-center py-16 bg-card rounded-xl shadow-sm">
            <History className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          {(subjects ?? []).map((s: SubjectType, i: number) => (
            <FadeIn key={s?.id ?? i} delay={i * 0.03}>
              <div className="bg-card rounded-xl shadow-sm p-4 border-l-4 border-l-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{s?.title ?? 'Sem título'}</h3>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {s?.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('pt-PT', { timeZone: 'UTC' }) : ''}
                      </span>
                    </div>
                    {s?.client && <p className="text-xs text-muted-foreground mt-1">Cliente: {s.client}</p>}
                    {s?.collaborator?.name && <p className="text-xs text-muted-foreground">Colaborador: {s.collaborator.name}</p>}
                    {s?.passedReason && (
                      <div className="mt-2 bg-amber-50 rounded-lg p-3 flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-700">Motivo</p>
                          <p className="text-sm text-amber-800">{s.passedReason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  )
}
