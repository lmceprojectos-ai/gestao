'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { MoloniSyncButton } from '@/components/moloni-sync-button';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';

const emptyForm = { nome: '', nif: '', email: '', telefone: '', morada: '', cidade: '', codigoPostal: '', website: '', redesSociais: '', contactoNome: '', contactoEmail: '', contactoTel: '', notas: '' };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => { fetch('/api/clientes').then((r) => r.json()).then((d: any) => setClientes(d ?? [])).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nome: c?.nome ?? '', nif: c?.nif ?? '', email: c?.email ?? '', telefone: c?.telefone ?? '',
      morada: c?.morada ?? '', cidade: c?.cidade ?? '', codigoPostal: c?.codigoPostal ?? '',
      website: c?.website ?? '', redesSociais: c?.redesSociais ?? '', contactoNome: c?.contactoNome ?? '', contactoEmail: c?.contactoEmail ?? '',
      contactoTel: c?.contactoTel ?? '', notas: c?.notas ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing ? `/api/clientes/${editing.id}` : '/api/clientes';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success(editing ? 'Cliente atualizado' : 'Cliente criado');
      setShowModal(false); load();
    } catch { toast.error('Erro de rede'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza?')) return;
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    toast.success('Cliente removido'); load();
  };

  const filtered = clientes.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c?.nome?.toLowerCase()?.includes(s) || c?.nif?.toLowerCase()?.includes(s) || c?.email?.toLowerCase()?.includes(s) || c?.cidade?.toLowerCase()?.includes(s));
  });

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title="Clientes" description={`${clientes.length} clientes registados`} action={<div className="flex gap-2"><MoloniSyncButton alvo="clientes" onDone={load} /><button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" />Novo Cliente</button></div>} />

      {clientes.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome, NIF, email ou cidade..." className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary outline-none" />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={search ? 'Sem resultados' : 'Sem clientes'} description={search ? 'Nenhum cliente corresponde à pesquisa.' : 'Adicione o primeiro cliente ou importe do Moloni.'} />
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Nome</th><th className="text-left px-4 py-3 font-medium hidden sm:table-cell">NIF</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cidade</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Telefone</th><th className="text-right px-4 py-3 font-medium">Ações</th></tr></thead>
              <tbody>
                {filtered.map((c: any) => (
                  <>
                    <tr key={c?.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === c?.id ? null : c?.id)}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {expandedId === c?.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          {c?.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell font-mono">{c?.nif ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{c?.email ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{c?.cidade ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{c?.telefone ?? '-'}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(c?.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c?.id && (
                      <tr key={`${c?.id}-detail`} className="bg-muted/20">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                            {c?.morada && <div><span className="text-muted-foreground">Morada:</span> <span className="text-foreground">{c.morada}</span></div>}
                            {c?.codigoPostal && <div><span className="text-muted-foreground">Código Postal:</span> <span className="text-foreground">{c.codigoPostal}</span></div>}
                            {c?.cidade && <div><span className="text-muted-foreground">Localidade:</span> <span className="text-foreground">{c.cidade}</span></div>}
                            {c?.website && <div><span className="text-muted-foreground">Site:</span> <span className="text-foreground">{c.website}</span></div>}
                            {c?.redesSociais && <div><span className="text-muted-foreground">Redes sociais:</span> <span className="text-foreground">{c.redesSociais}</span></div>}
                            {c?.contactoNome && <div><span className="text-muted-foreground">Responsável:</span> <span className="text-foreground">{c.contactoNome}</span></div>}
                            {c?.contactoEmail && <div><span className="text-muted-foreground">Email pessoal:</span> <span className="text-foreground">{c.contactoEmail}</span></div>}
                            {c?.contactoTel && <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{c.contactoTel}</span></div>}
                            {c?.notas && <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Notas:</span> <span className="text-foreground">{c.notas}</span></div>}
                            {c?.moloniId && <div><span className="text-muted-foreground">Moloni ID:</span> <span className="text-foreground font-mono">{c.moloniId}</span></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            {filtered.length} de {clientes.length} clientes
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h2><button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1">Empresa / Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
                <div><label className="block text-sm font-medium mb-1">NIF</label><input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Email geral</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Site</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Redes sociais</label><input value={form.redesSociais} onChange={(e) => setForm({ ...form, redesSociais: e.target.value })} placeholder="Facebook, Instagram, LinkedIn..." className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1">Morada completa</label><input value={form.morada} onChange={(e) => setForm({ ...form, morada: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Código Postal</label><input value={form.codigoPostal} onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })} placeholder="0000-000" className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Localidade</label><input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">Responsável</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Nome do responsável</label><input value={form.contactoNome} onChange={(e) => setForm({ ...form, contactoNome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                  <div><label className="block text-sm font-medium mb-1">Email pessoal</label><input value={form.contactoEmail} onChange={(e) => setForm({ ...form, contactoEmail: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                  <div><label className="block text-sm font-medium mb-1">Telefone</label><input value={form.contactoTel} onChange={(e) => setForm({ ...form, contactoTel: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground resize-none" /></div>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90">{editing ? 'Guardar' : 'Criar Cliente'}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
