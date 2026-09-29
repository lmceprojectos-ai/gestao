'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Pencil, Trash2, Save, X, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { CollaboratorType } from '@/lib/conexus/types'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/ui/animate'

const COLLABORATOR_COLORS = [
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#1e3a5f', label: 'Navy' },
  { value: '#6b7280', label: 'Cinza' },
  { value: '#78716c', label: 'Castanho' },
]

export function CollaboratorsClient() {
  const [collaborators, setCollaborators] = useState<CollaboratorType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CollaboratorType | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [color, setColor] = useState('#06b6d4')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentialCollab, setCredentialCollab] = useState<CollaboratorType | null>(null)
  const [credentialEmail, setCredentialEmail] = useState('')
  const [sendingCredentials, setSendingCredentials] = useState(false)

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/collaborators')
      const data = await res.json()
      setCollaborators(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCollaborators()
  }, [fetchCollaborators])

  const openForm = (collab?: CollaboratorType) => {
    if (collab) {
      setEditing(collab)
      setName(collab?.name ?? '')
      setRole(collab?.role ?? '')
      setColor(collab?.color || '#1e3a5f')
      setEmail(collab?.email ?? '')
    } else {
      setEditing(null)
      setName('')
      setRole('')
      setColor('#06b6d4')
      setEmail('')
    }
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!name?.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/conexus/collaborators/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name?.trim(), role, color, email }),
        })
        toast.success('Colaborador atualizado')
      } else {
        await fetch('/api/conexus/collaborators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name?.trim(), role, color, email }),
        })
        toast.success('Colaborador adicionado')
      }
      setShowForm(false)
      fetchCollaborators()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao guardar colaborador')
    } finally {
      setSaving(false)
    }
  }

  const openCredentials = (collab: CollaboratorType) => {
    setCredentialCollab(collab)
    setCredentialEmail(collab.email || '')
    setShowCredentials(true)
  }

  const handleSendCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentialCollab || !credentialEmail?.trim()) return
    setSendingCredentials(true)
    try {
      const res = await fetch('/api/conexus/auth/send-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaboratorId: credentialCollab.id, email: credentialEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao enviar credenciais')
        return
      }
      if (data.emailSent) {
        toast.success('Credenciais enviadas por email!')
      } else {
        toast.warning(data.message || 'Conta criada, email n\u00e3o enviado')
      }
      setShowCredentials(false)
      fetchCollaborators()
    } catch {
      toast.error('Erro ao enviar credenciais')
    } finally {
      setSendingCredentials(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que deseja remover este colaborador?')) return
    try {
      await fetch(`/api/conexus/collaborators/${id}`, { method: 'DELETE' })
      toast.success('Colaborador removido')
      fetchCollaborators()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao remover colaborador')
    }
  }

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerir a equipa de colaboradores</p>
          </div>
          <Button onClick={() => openForm()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
            <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
          </Button>
        </div>
      </FadeIn>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : (collaborators?.length ?? 0) === 0 ? (
        <FadeIn>
          <div className="text-center py-16 bg-card rounded-xl shadow-sm">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum colaborador registado</p>
            <Button variant="outline" className="mt-4" onClick={() => openForm()}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar colaborador
            </Button>
          </div>
        </FadeIn>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(collaborators ?? []).map((c: CollaboratorType, i: number) => (
            <FadeIn key={c?.id ?? i} delay={i * 0.05}>
              <div className="bg-card rounded-xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow" style={{ borderLeft: `5px solid ${c?.color || '#1e3a5f'}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm" style={{ backgroundColor: c?.color || '#1e3a5f' }}>
                    {c?.name?.charAt?.(0)?.toUpperCase?.() ?? '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{c?.name ?? ''}</p>
                    <p className="text-xs text-muted-foreground">{c?.role || 'Sem função definida'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c?.email || 'Sem acesso (sem email)'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openForm(c)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c?.id ?? '')} className="text-destructive" title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Send Credentials Modal */}
      <Dialog open={showCredentials} onOpenChange={(val: boolean) => { if (!val) setShowCredentials(false) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Enviar Dados de Acesso
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendCredentials} className="space-y-4 mt-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Ser\u00e1 criada uma conta para <strong>{credentialCollab?.name}</strong> com uma password tempor\u00e1ria, enviada por email.
              </p>
            </div>
            <div>
              <Label htmlFor="cred-email">Email do colaborador *</Label>
              <Input
                id="cred-email"
                type="email"
                value={credentialEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentialEmail(e?.target?.value ?? '')}
                placeholder="colaborador@email.com"
                required
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCredentials(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button type="submit" disabled={sendingCredentials || !credentialEmail?.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="h-4 w-4 mr-1" /> {sendingCredentials ? 'A enviar...' : 'Enviar Credenciais'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={(val: boolean) => { if (!val) setShowForm(false) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? 'Editar Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="collab-name">Nome *</Label>
              <Input
                id="collab-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')}
                placeholder="Nome do colaborador"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collab-role">Função</Label>
              <Input
                id="collab-role"
                value={role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e?.target?.value ?? '')}
                placeholder="Ex: Técnico, Gestor"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collab-email">Email da conta (acesso às suas tarefas)</Label>
              <Input
                id="collab-email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e?.target?.value ?? '')}
                placeholder="email com que entra na Gestão ou no Ponto"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Quem entrar com este email vê e trata só as tarefas deste colaborador.</p>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {COLLABORATOR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                      color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  >
                    {color === c.value && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button type="submit" disabled={saving || !name?.trim()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                <Save className="h-4 w-4 mr-1" /> {editing ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
