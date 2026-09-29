'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Send, Save, Eye, EyeOff, HelpCircle, ChevronDown, ChevronUp, Key, Hash, Plus, Pencil, Trash2, Tag, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import type { CategoryType, ReminderStatusType } from '@/lib/conexus/types'

const COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: 'Azul' },
  { value: 'bg-purple-500', label: 'Roxo' },
  { value: 'bg-emerald-500', label: 'Verde' },
  { value: 'bg-red-500', label: 'Vermelho' },
  { value: 'bg-amber-500', label: 'Amarelo' },
  { value: 'bg-pink-500', label: 'Rosa' },
  { value: 'bg-cyan-500', label: 'Ciano' },
  { value: 'bg-slate-500', label: 'Cinza' },
  { value: 'bg-orange-500', label: 'Laranja' },
  { value: 'bg-teal-500', label: 'Teal' },
]

const TEXT_COLOR_OPTIONS = [
  { value: 'text-blue-500', label: 'Azul' },
  { value: 'text-emerald-500', label: 'Verde' },
  { value: 'text-red-500', label: 'Vermelho' },
  { value: 'text-amber-500', label: 'Amarelo' },
  { value: 'text-purple-500', label: 'Roxo' },
  { value: 'text-slate-400', label: 'Cinza' },
  { value: 'text-orange-500', label: 'Laranja' },
]

export function SettingsClient() {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)

  // Categories
  const [categories, setCategories] = useState<CategoryType[]>([])
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoryType | null>(null)
  const [catLabel, setCatLabel] = useState('')
  const [catIcon, setCatIcon] = useState('📌')
  const [catColor, setCatColor] = useState('bg-slate-500')
  const [catSaving, setCatSaving] = useState(false)

  // Reminder statuses
  const [remStatuses, setRemStatuses] = useState<ReminderStatusType[]>([])
  const [remModalOpen, setRemModalOpen] = useState(false)
  const [editingRem, setEditingRem] = useState<ReminderStatusType | null>(null)
  const [remLabel, setRemLabel] = useState('')
  const [remIcon, setRemIcon] = useState('⚪')
  const [remColor, setRemColor] = useState('text-slate-400')
  const [remSaving, setRemSaving] = useState(false)

  // Active section
  const [activeSection, setActiveSection] = useState<'telegram' | 'categorias' | 'lembretes'>('categorias')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/settings')
      const data = await res.json()
      setBotToken(data?.telegramBotToken ?? '')
      setChatId(data?.telegramChatId ?? '')
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err: any) { console.error(err) }
  }, [])

  const fetchRemStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/conexus/reminder-statuses')
      const data = await res.json()
      setRemStatuses(Array.isArray(data) ? data : [])
    } catch (err: any) { console.error(err) }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchCategories()
    fetchRemStatuses()
  }, [fetchSettings, fetchCategories, fetchRemStatuses])

  // Telegram handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/conexus/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramBotToken: botToken, telegramChatId: chatId }),
      })
      if (res?.ok) toast.success('Configurações guardadas')
      else toast.error('Erro ao guardar')
    } catch { toast.error('Erro ao guardar') } finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!botToken || !chatId) { toast.error('Preencha Bot Token e Chat ID'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/conexus/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId }),
      })
      const data = await res.json()
      if (res?.ok) toast.success(data?.message ?? 'Teste enviado!')
      else toast.error(data?.error ?? 'Erro ao testar')
    } catch { toast.error('Erro ao testar') } finally { setTesting(false) }
  }

  // Category handlers
  const openCatModal = (cat?: CategoryType) => {
    if (cat) {
      setEditingCat(cat)
      setCatLabel(cat.label)
      setCatIcon(cat.icon)
      setCatColor(cat.color)
    } else {
      setEditingCat(null)
      setCatLabel('')
      setCatIcon('📌')
      setCatColor('bg-slate-500')
    }
    setCatModalOpen(true)
  }

  const handleCatSubmit = async () => {
    if (!catLabel.trim()) return
    setCatSaving(true)
    try {
      if (editingCat) {
        await fetch(`/api/conexus/categories/${editingCat.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: catLabel, icon: catIcon, color: catColor }),
        })
        toast.success('Categoria atualizada')
      } else {
        const res = await fetch('/api/conexus/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: catLabel, icon: catIcon, color: catColor }),
        })
        if (res.status === 409) { toast.error('Já existe uma categoria com esse nome'); return }
        toast.success('Categoria criada')
      }
      setCatModalOpen(false)
      fetchCategories()
    } catch { toast.error('Erro ao guardar categoria') } finally { setCatSaving(false) }
  }

  const handleCatDelete = async (id: string) => {
    if (!confirm('Remover esta categoria?')) return
    try {
      await fetch(`/api/conexus/categories/${id}`, { method: 'DELETE' })
      toast.success('Categoria removida')
      fetchCategories()
    } catch { toast.error('Erro ao remover') }
  }

  // Reminder status handlers
  const openRemModal = (rem?: ReminderStatusType) => {
    if (rem) {
      setEditingRem(rem)
      setRemLabel(rem.label)
      setRemIcon(rem.icon)
      setRemColor(rem.color)
    } else {
      setEditingRem(null)
      setRemLabel('')
      setRemIcon('⚪')
      setRemColor('text-slate-400')
    }
    setRemModalOpen(true)
  }

  const handleRemSubmit = async () => {
    if (!remLabel.trim()) return
    setRemSaving(true)
    try {
      if (editingRem) {
        await fetch(`/api/conexus/reminder-statuses/${editingRem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: remLabel, icon: remIcon, color: remColor }),
        })
        toast.success('Estado atualizado')
      } else {
        const res = await fetch('/api/conexus/reminder-statuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: remLabel, icon: remIcon, color: remColor }),
        })
        if (res.status === 409) { toast.error('Já existe um estado com esse nome'); return }
        toast.success('Estado criado')
      }
      setRemModalOpen(false)
      fetchRemStatuses()
    } catch { toast.error('Erro ao guardar') } finally { setRemSaving(false) }
  }

  const handleRemDelete = async (id: string) => {
    if (!confirm('Remover este estado?')) return
    try {
      await fetch(`/api/conexus/reminder-statuses/${id}`, { method: 'DELETE' })
      toast.success('Estado removido')
      fetchRemStatuses()
    } catch { toast.error('Erro ao remover') }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground pt-10 md:pt-0">A carregar...</div>
  }

  return (
    <div className="space-y-6 pt-10 md:pt-0">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Categorias, estados de lembrete e integração Telegram</p>
        </div>
      </FadeIn>

      {/* Section Tabs */}
      <FadeIn delay={0.05}>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'categorias' as const, label: 'Categorias', icon: Tag },
            { key: 'lembretes' as const, label: 'Estados de Lembrete', icon: Bell },
            { key: 'telegram' as const, label: 'Telegram', icon: Send },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all border flex items-center gap-2 ${
                activeSection === tab.key
                  ? 'bg-[#1e3a5f] text-white border-transparent shadow-sm'
                  : 'bg-card border-border text-foreground hover:bg-muted'
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* === CATEGORIAS === */}
      {activeSection === 'categorias' && (
        <FadeIn delay={0.1}>
          <div className="bg-card rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-[#f97316]" />
                <h2 className="font-semibold text-lg">Categorias de Assuntos</h2>
              </div>
              <Button onClick={() => openCatModal()} size="sm" className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                <Plus className="h-4 w-4 mr-1" /> Nova
              </Button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                    <span className="text-lg">{cat.icon}</span>
                    <span className="font-medium">{cat.label}</span>
                    <span className="text-xs text-muted-foreground">({cat.value})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openCatModal(cat)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleCatDelete(cat.id)} className="text-destructive" title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria configurada</p>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* === ESTADOS DE LEMBRETE === */}
      {activeSection === 'lembretes' && (
        <FadeIn delay={0.1}>
          <div className="bg-card rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#f97316]" />
                <h2 className="font-semibold text-lg">Estados de Lembrete</h2>
              </div>
              <Button onClick={() => openRemModal()} size="sm" className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>
            <div className="space-y-2">
              {remStatuses.map((rem) => (
                <div key={rem.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${rem.color}`}>{rem.icon}</span>
                    <span className="font-medium">{rem.label}</span>
                    <span className="text-xs text-muted-foreground">({rem.value})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openRemModal(rem)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleRemDelete(rem.id)} className="text-destructive" title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {remStatuses.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum estado configurado</p>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* === TELEGRAM === */}
      {activeSection === 'telegram' && (
        <>
          <FadeIn delay={0.1}>
            <div className="bg-card rounded-xl shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-[#f97316]" />
                <h2 className="font-semibold text-lg">Telegram</h2>
              </div>
              <div>
                <Label htmlFor="botToken" className="flex items-center gap-1"><Key className="h-3.5 w-3.5" /> Bot Token</Label>
                <div className="relative mt-1">
                  <Input id="botToken" type={showToken ? 'text' : 'password'} value={botToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBotToken(e?.target?.value ?? '')} placeholder="Cole aqui o token" className="pr-10" />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="chatId" className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Chat ID</Label>
                <Input id="chatId" value={chatId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatId(e?.target?.value ?? '')} placeholder="Ex: 123456789" className="mt-1" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                  <Save className="h-4 w-4 mr-2" /> {saving ? 'A guardar...' : 'Guardar'}
                </Button>
                <Button onClick={handleTest} disabled={testing} variant="outline" className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white">
                  <Send className="h-4 w-4 mr-2" /> {testing ? 'A enviar...' : 'Testar Ligação'}
                </Button>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="bg-card rounded-xl shadow-sm overflow-hidden">
              <button onClick={() => setHelpOpen(!helpOpen)} className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-[#f97316]" />
                  <h2 className="font-semibold text-lg">Como configurar o Telegram</h2>
                </div>
                {helpOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {helpOpen && (
                <div className="px-6 pb-6 space-y-5">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold">1</div>
                      <h3 className="font-semibold">Criar um Bot no Telegram</h3>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-9">
                      <li>Abra o Telegram e procure por <strong>@BotFather</strong></li>
                      <li>Envie <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">/newbot</code></li>
                      <li>Escolha um nome e username (termina em "bot")</li>
                      <li>Copie o <strong>Bot Token</strong></li>
                    </ol>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold">2</div>
                      <h3 className="font-semibold">Obter o Chat ID</h3>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-9">
                      <li>Envie uma mensagem ao seu bot</li>
                      <li>Abra: <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                      <li>Copie o número do campo <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">"chat":{'{'}"id":XXXXXXX{'}'}</code></li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </FadeIn>
        </>
      )}

      {/* Category Modal */}
      <Dialog open={catModalOpen} onOpenChange={(val: boolean) => { if (!val) setCatModalOpen(false) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={catLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatLabel(e?.target?.value ?? '')} placeholder="Nome da categoria" className="mt-1" />
            </div>
            <div>
              <Label>Ícone (emoji)</Label>
              <Input value={catIcon} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatIcon(e?.target?.value ?? '')} placeholder="📌" className="mt-1 w-20" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_OPTIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setCatColor(c.value)}
                    className={`w-8 h-8 rounded-lg ${c.value} transition-all ${catColor === c.value ? 'ring-2 ring-offset-2 ring-[#1e3a5f] scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={c.label} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCatModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleCatSubmit} disabled={catSaving || !catLabel.trim()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                <Save className="h-4 w-4 mr-1" /> {editingCat ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Status Modal */}
      <Dialog open={remModalOpen} onOpenChange={(val: boolean) => { if (!val) setRemModalOpen(false) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingRem ? 'Editar Estado' : 'Novo Estado de Lembrete'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={remLabel} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemLabel(e?.target?.value ?? '')} placeholder="Nome do estado" className="mt-1" />
            </div>
            <div>
              <Label>Ícone (emoji)</Label>
              <Input value={remIcon} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemIcon(e?.target?.value ?? '')} placeholder="⚪" className="mt-1 w-20" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TEXT_COLOR_OPTIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setRemColor(c.value)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${c.value} ${remColor === c.value ? 'ring-2 ring-offset-1 ring-[#1e3a5f] border-transparent' : 'border-border hover:bg-muted'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRemModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleRemSubmit} disabled={remSaving || !remLabel.trim()} className="bg-[#f97316] hover:bg-[#ea580c] text-white">
                <Save className="h-4 w-4 mr-1" /> {editingRem ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
