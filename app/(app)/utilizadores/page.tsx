'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  Eye,
  PenLine,
  FilePlus,
  Receipt,
  Send,
  Wallet,
  Clock,
  SlidersHorizontal,
  RotateCcw, Handshake } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { currentMonth } from '@/lib/ponto/format';
import {
  AREAS,
  LEVELS,
  roleBasePerms,
  type RolePermissions,
  type AreaKey,
  type PermLevel,
} from '@/lib/permissions';

interface AppUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  lastLogin: string | null;
  createdAt: string;
  isPontoUser?: boolean;
  parceiroEmpresa?: string | null;
  pontoRole?: string | null;
  sendToAccounting?: boolean;
  partTime?: boolean;
  pontoEffectiveRole?: string | null;
  permissions?: string | null;
}

const LEVEL_COLOR: Record<PermLevel, string> = {
  none: 'text-red-600',
  view: 'text-slate-600',
  insert: 'text-amber-600',
  edit: 'text-emerald-600',
};

const ROLES = [
  {
    valor: 'admin',
    label: 'Administrador',
    descricao: 'Acesso total, incluindo gestão de utilizadores.',
    cor: 'bg-blue-100 text-blue-700',
    icon: ShieldCheck,
  },
  {
    valor: 'editor',
    label: 'Editor',
    descricao: 'Pode ver e editar todos os dados e gerir utilizadores (exceto contas de administrador).',
    cor: 'bg-emerald-100 text-emerald-700',
    icon: PenLine,
  },
  {
    valor: 'insercao',
    label: 'Operativo',
    descricao: 'Só pode inserir e digitalizar documentos. Não edita nem apaga, e não vê os totais.',
    cor: 'bg-violet-100 text-violet-700',
    icon: FilePlus,
  },
  {
    valor: 'parceiro',
    label: 'Parceiro',
    descricao: 'Só acede aos Parceiros (conta corrente). Ex.: a conta da Reclamarte. Não vê a Gestão.',
    cor: 'bg-sky-100 text-sky-700',
    icon: Handshake,
  },
  {
    valor: 'leitura',
    label: 'Leitura',
    descricao: 'Apenas consulta. Não pode criar nem alterar dados.',
    cor: 'bg-slate-100 text-slate-700',
    icon: Eye,
  },
];

const PONTO_ROLE_INFO = {
  valor: 'ponto',
  label: 'Conta de ponto',
  descricao: 'Conta do controlo de ponto, sem perfil financeiro.',
  cor: 'bg-amber-100 text-amber-700',
  icon: Clock,
};

function roleInfo(role: string) {
  return ROLES.find((r) => r.valor === role) || PONTO_ROLE_INFO;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  try {
    const parts = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Lisbon',
    }).formatToParts(new Date(value));
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
  } catch {
    return '—';
  }
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  parceiroEmpresa: string;
}

const emptyForm: FormState = { name: '', email: '', password: '', role: 'leitura', parceiroEmpresa: '' };
const EMPRESA_LABEL: Record<string, string> = { CRIACONSENSOS: 'Criaconsensos', RECLAMARTE: 'Reclamarte' };

export default function UtilizadoresPage() {
  const { data: session } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [perms, setPerms] = useState<RolePermissions>(() => roleBasePerms('leitura'));
  const [pontoUser, setPontoUser] = useState<AppUser | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao carregar utilizadores');
        setUsers([]);
      } else {
        setUsers(Array.isArray(data) ? data : data?.users ?? []);
      }
    } catch {
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setPerms(roleBasePerms(emptyForm.role));
    setShowModal(true);
  }

  function openEdit(u: AppUser) {
    setEditing(u);
    setForm({ name: u.name ?? '', email: u.email, password: '', role: u.role, parceiroEmpresa: u.parceiroEmpresa ?? '' });
    // Carregar permissões: base do perfil, sobreposta pelas personalizadas (se existirem).
    const base = roleBasePerms(u.role);
    if (u.permissions) {
      try {
        const raw = JSON.parse(u.permissions);
        for (const a of AREAS) {
          const v = raw?.[a.key];
          if (v === 'none' || v === 'view' || v === 'insert' || v === 'edit') base[a.key] = v;
        }
      } catch { /* ignora JSON inválido */ }
    }
    setPerms(base);
    setShowModal(true);
  }

  // Ao mudar o perfil, repor as permissões para as predefinições desse perfil.
  function changeRole(newRole: string) {
    setForm((f) => ({ ...f, role: newRole, parceiroEmpresa: newRole === 'parceiro' && !f.parceiroEmpresa ? 'RECLAMARTE' : f.parceiroEmpresa }));
    setPerms(roleBasePerms(newRole));
  }

  function setPermCell(area: AreaKey, level: PermLevel) {
    setPerms((prev) => ({ ...prev, [area]: level }));
  }

  function resetPermsToRole() {
    setPerms(roleBasePerms(form.role));
    toast.message('Permissões repostas', { description: 'Ficaram iguais às predefinições do perfil selecionado.' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Indique o nome do utilizador');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Indique o email do utilizador');
      return;
    }
    if (!editing && form.password.trim().length < 6) {
      toast.error('A palavra-passe deve ter pelo menos 6 caracteres');
      return;
    }
    if (editing && form.password.trim() && form.password.trim().length < 6) {
      toast.error('A palavra-passe deve ter pelo menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        parceiroEmpresa: form.parceiroEmpresa || null,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      // Permissões personalizadas (apenas o administrador as define; nunca para
      // contas de administrador). Se forem iguais às predefinições do perfil,
      // envia-se null (o utilizador segue automaticamente o perfil).
      if (isAdmin) {
        if (form.role === 'admin') {
          payload.permissions = null;
        } else {
          const base = roleBasePerms(form.role);
          const isDefault = AREAS.every((a) => perms[a.key] === base[a.key]);
          payload.permissions = isDefault ? null : perms;
        }
      }

      const url = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao guardar utilizador');
      } else {
        toast.success(editing ? 'Utilizador atualizado' : 'Utilizador criado');
        setShowModal(false);
        load();
      }
    } catch {
      toast.error('Erro ao guardar utilizador');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: AppUser) {
    if (!confirm(`Eliminar o utilizador "${u.name || u.email}"? Esta ação não pode ser anulada.`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao eliminar utilizador');
      } else {
        toast.success('Utilizador eliminado');
        load();
      }
    } catch {
      toast.error('Erro ao eliminar utilizador');
    }
  }

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title="Utilizadores"
        description="Gerir contas de acesso e permissões"
        action={
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            Novo Utilizador
          </button>
        }
      />

      {/* Legenda de perfis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.valor} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${r.cor}`}>
                  <Icon className="h-3 w-3" />
                  {r.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.descricao}</p>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="Sem utilizadores"
            description="Ainda não existem contas registadas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Último acesso</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const info = roleInfo(u.role);
                  const Icon = info.icon;
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${info.cor}`}>
                          <Icon className="h-3 w-3" />
                          {info.label}
                        </span>
                        {u.parceiroEmpresa && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                            <Handshake className="h-3 w-3" />{EMPRESA_LABEL[u.parceiroEmpresa] ?? u.parceiroEmpresa}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(u.lastLogin)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && u.isPontoUser && u.pontoEffectiveRole === 'COLABORADOR' && (
                            <button
                              onClick={() => setPontoUser(u)}
                              className="p-1.5 rounded-md hover:bg-muted transition"
                              title="Recibos / Ponto"
                            >
                              <Receipt className="h-3.5 w-3.5 text-primary" />
                            </button>
                          )}
                          {(isAdmin || u.role?.toLowerCase() !== 'admin') && (
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-md hover:bg-muted transition"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-md hover:bg-muted transition"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !saving && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-bold text-foreground">
                  {editing ? 'Editar Utilizador' : 'Novo Utilizador'}
                </h2>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                    placeholder="email@exemplo.pt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Palavra-passe {editing && <span className="text-muted-foreground font-normal">(deixe vazio para manter)</span>}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                    placeholder={editing ? '••••••' : 'Mínimo 6 caracteres'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Perfil</label>
                  <select
                    value={form.role}
                    onChange={(e) => changeRole(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                  >
                    {!ROLES.some((r) => r.valor === form.role) && (
                      <option value={form.role}>Conta de controlo de ponto (sem perfil financeiro)</option>
                    )}
                    {ROLES.filter((r) => isAdmin || r.valor !== 'admin').map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {ROLES.some((r) => r.valor === form.role)
                      ? roleInfo(form.role).descricao
                      : 'Conta criada no controlo de ponto. Por defeito não tem acesso às áreas financeiras — atribua um perfil acima ou defina permissões por área em baixo.'}
                  </p>
                </div>

                {/* Parceiros (conta corrente com a Reclamarte) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Acesso aos Parceiros</label>
                  <select
                    value={form.parceiroEmpresa}
                    onChange={(e) => setForm((f) => ({ ...f, parceiroEmpresa: e.target.value }))}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                  >
                    {form.role !== 'parceiro' && <option value="">{form.role === 'admin' ? 'Criaconsensos (administrador)' : 'Sem acesso'}</option>}
                    <option value="CRIACONSENSOS">Criaconsensos</option>
                    <option value="RECLAMARTE">Reclamarte</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">Empresa com que o utilizador regista na conta corrente. Cada empresa só altera os seus registos.</p>
                </div>

                {/* Permissões personalizadas por utilizador (apenas administradores) */}
                {isAdmin && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/50 border-b">
                      <div className="flex items-center gap-2 min-w-0">
                        <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Permissões de acesso</p>
                          <p className="text-xs text-muted-foreground">O que este utilizador pode ver e fazer em cada área.</p>
                        </div>
                      </div>
                      {form.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={resetPermsToRole}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted transition shrink-0"
                          title="Repor as predefinições do perfil"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Repor
                        </button>
                      )}
                    </div>
                    {form.role === 'admin' ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        Os administradores têm sempre acesso total a todas as áreas.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {AREAS.map((a) => (
                          <div key={a.key} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                              <p className="text-[11px] text-muted-foreground leading-snug">{a.descricao}</p>
                            </div>
                            <select
                              value={perms[a.key]}
                              onChange={(e) => setPermCell(a.key, e.target.value as PermLevel)}
                              className={`shrink-0 w-[190px] rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-primary outline-none ${LEVEL_COLOR[perms[a.key]]}`}
                            >
                              {LEVELS.map((lv) => (
                                <option key={lv.key} value={lv.key} className="text-foreground">{lv.label}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => !saving && setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editing ? 'Guardar' : 'Criar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de recibos / ponto do colaborador */}
      <AnimatePresence>
        {pontoUser && (
          <PontoReciboModal
            user={pontoUser}
            onClose={() => setPontoUser(null)}
            onChanged={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PontoReciboModal({
  user,
  onClose,
  onChanged,
}: {
  user: AppUser;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [gen, setGen] = useState(false);
  const [snd, setSnd] = useState(false);
  const [sendToAccounting, setSendToAccounting] = useState(!!user.sendToAccounting);
  const [partTime, setPartTime] = useState(!!user.partTime);
  const [savingFlag, setSavingFlag] = useState<'accounting' | 'partTime' | null>(null);

  async function patchUser(payload: Record<string, boolean>) {
    const res = await fetch(`/api/ponto/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
  }

  async function toggleAccounting(v: boolean) {
    setSendToAccounting(v);
    setSavingFlag('accounting');
    try {
      await patchUser({ sendToAccounting: v });
      toast.success(v ? 'Recibo marcado para a contabilidade.' : 'Recibo excluído do envio à contabilidade.');
      onChanged();
    } catch {
      setSendToAccounting(!v);
      toast.error('Erro ao atualizar.');
    } finally {
      setSavingFlag(null);
    }
  }

  async function togglePartTime(v: boolean) {
    setPartTime(v);
    setSavingFlag('partTime');
    try {
      await patchUser({ partTime: v });
      toast.success(v ? 'Colaborador marcado como tempo parcial.' : 'Tempo parcial desativado.');
      onChanged();
    } catch {
      setPartTime(!v);
      toast.error('Erro ao atualizar.');
    } finally {
      setSavingFlag(null);
    }
  }

  async function gerar() {
    setGen(true);
    try {
      const res = await fetch('/api/ponto/admin/payslips/generate-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Erro');
      toast.success(
        data?.createdProfile
          ? 'Recibo gerado. Criado perfil salarial (valores a zero) — edite-o em Recibos.'
          : 'Recibo e ponto de assiduidade gerados.'
      );
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o recibo.');
    } finally {
      setGen(false);
    }
  }

  async function enviar() {
    setSnd(true);
    try {
      const res = await fetch('/api/ponto/admin/payslips/send-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Erro');
      toast.success(
        data?.emailed
          ? 'Recibo enviado à contabilidade por email.'
          : 'Pedido processado, mas o email não foi confirmado.'
      );
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar à contabilidade.');
    } finally {
      setSnd(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Recibos / Ponto
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {user.name || user.email}
          {user.partTime && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5">
              Part-time
            </span>
          )}
        </p>

        {/* Mês + gerar/enviar */}
        <div className="rounded-xl bg-muted/50 px-3 py-3 flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Mês</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="ml-auto text-sm rounded-md border border-input bg-background px-2 py-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={gerar}
              disabled={gen}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Gerar recibo
            </button>
            <button
              onClick={enviar}
              disabled={snd}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {snd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar à contabilidade
            </button>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <ToggleRow
            icon={<Receipt className="h-4 w-4 text-primary shrink-0" />}
            label="Enviar recibo à contabilidade"
            hint="Incluir no envio mensal para a contabilidade."
            checked={sendToAccounting}
            disabled={savingFlag === 'accounting'}
            onChange={toggleAccounting}
          />
          <ToggleRow
            icon={<Clock className="h-4 w-4 text-primary shrink-0" />}
            label="Tempo parcial (part-time)"
            hint="Marca apenas entrada e saída (com opção de dia completo)."
            checked={partTime}
            disabled={savingFlag === 'partTime'}
            onChange={togglePartTime}
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
