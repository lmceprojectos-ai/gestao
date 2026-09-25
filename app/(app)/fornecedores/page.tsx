'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Plus, Edit2, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { MoloniSyncButton } from '@/components/moloni-sync-button';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';

const TIPOS_FORNECEDOR: Record<string, string> = { desp_mensal: 'Desp. Mensal', desp_pontual: 'Desp. Pontual', servico: 'Serviço', material: 'Material', subcontrato: 'Subcontrato', outro: 'Outro' };
const emptyForm = { nome: '', nif: '', email: '', telefone: '', morada: '', cidade: '', codigoPostal: '', website: '', contactoNome: '', contactoEmail: '', contactoTel: '', notas: '', tipoFornecedor: '' };

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('nome');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => { fetch('/api/fornecedores').then((r) => r.json()).then((d: any) => setFornecedores(d ?? [])).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (f: any) => {
    setEditing(f);
    setForm({
      nome: f?.nome ?? '', nif: f?.nif ?? '', email: f?.email ?? '', telefone: f?.telefone ?? '',
      morada: f?.morada ?? '', cidade: f?.cidade ?? '', codigoPostal: f?.codigoPostal ?? '',
      website: f?.website ?? '', contactoNome: f?.contactoNome ?? '', contactoEmail: f?.contactoEmail ?? '',
      contactoTel: f?.contactoTel ?? '', notas: f?.notas ?? '', tipoFornecedor: f?.tipoFornecedor ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing ? `/api/fornecedores/${editing.id}` : '/api/fornecedores';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor criado');
      setShowModal(false); load();
    } catch { toast.error('Erro de rede'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza?')) return;
    await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' });
    toast.success('Fornecedor removido'); load();
  };

  const filtered = fornecedores.filter((f: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (f?.nome?.toLowerCase()?.includes(s) || f?.nif?.toLowerCase()?.includes(s) || f?.email?.toLowerCase()?.includes(s) || f?.cidade?.toLowerCase()?.includes(s));
  });

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'atualizacao') return (b?.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a?.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    return (a?.nome || '').localeCompare(b?.nome || '', 'pt');
  });

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={Truck} title="Fornecedores" description={`${fornecedores.length} fornecedores registados`} action={<div className="flex gap-2"><MoloniSyncButton alvo="fornecedores" onDone={load} /><button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" />Novo Fornecedor</button></div>} />

      {fornecedores.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome, NIF, email ou cidade..." className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground" title="Ordenar">
            <option value="nome">Nome (A-Z)</option>
            <option value="atualizacao">Última atualização</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Truck} title={search ? 'Sem resultados' : 'Sem fornecedores'} description={search ? 'Nenhum fornecedor corresponde à pesquisa.' : 'Adicione o primeiro fornecedor ou importe do Moloni.'} />
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Nome</th><th className="text-left px-4 py-3 font-medium hidden sm:table-cell">NIF</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Tipo</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cidade</th><th className="text-right px-4 py-3 font-medium">Ações</th></tr></thead>
              <tbody>
                {sorted.map((f: any) => (
                  <>
                    <tr key={f?.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === f?.id ? null : f?.id)}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {expandedId === f?.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          {f?.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell font-mono">{f?.nif ?? '-'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{f?.tipoFornecedor ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{TIPOS_FORNECEDOR[f.tipoFornecedor] || f.tipoFornecedor}</span> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{f?.email ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{f?.cidade ?? '-'}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(f)} className="p-1.5 rounded-md hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(f?.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === f?.id && (
                      <tr key={`${f?.id}-detail`} className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                            {f?.morada && <div><span className="text-muted-foreground">Morada:</span> <span className="text-foreground">{f.morada}</span></div>}
                            {f?.codigoPostal && <div><span className="text-muted-foreground">Código Postal:</span> <span className="text-foreground">{f.codigoPostal}</span></div>}
                            {f?.website && <div><span className="text-muted-foreground">Website:</span> <span className="text-foreground">{f.website}</span></div>}
                            {f?.contactoNome && <div><span className="text-muted-foreground">Contacto:</span> <span className="text-foreground">{f.contactoNome}</span></div>}
                            {f?.contactoEmail && <div><span className="text-muted-foreground">Email Contacto:</span> <span className="text-foreground">{f.contactoEmail}</span></div>}
                            {f?.contactoTel && <div><span className="text-muted-foreground">Tel. Contacto:</span> <span className="text-foreground">{f.contactoTel}</span></div>}
                            {f?.notas && <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Notas:</span> <span className="text-foreground">{f.notas}</span></div>}
                            {f?.moloniId && <div><span className="text-muted-foreground">Moloni ID:</span> <span className="text-foreground font-mono">{f.moloniId}</span></div>}
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
            {filtered.length} de {fornecedores.length} fornecedores
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2><button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
                <div><label className="block text-sm font-medium mb-1">NIF</label><input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Tipo Fornecedor</label><select value={form.tipoFornecedor} onChange={(e) => setForm({ ...form, tipoFornecedor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">-- Sem tipo --</option>{Object.entries(TIPOS_FORNECEDOR).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1">Morada</label><input value={form.morada} onChange={(e) => setForm({ ...form, morada: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Cidade</label><input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Código Postal</label><input value={form.codigoPostal} onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">Contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Nome</label><input value={form.contactoNome} onChange={(e) => setForm({ ...form, contactoNome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                  <div><label className="block text-sm font-medium mb-1">Email</label><input value={form.contactoEmail} onChange={(e) => setForm({ ...form, contactoEmail: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                  <div><label className="block text-sm font-medium mb-1">Telefone</label><input value={form.contactoTel} onChange={(e) => setForm({ ...form, contactoTel: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground resize-none" /></div>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90">{editing ? 'Guardar' : 'Criar Fornecedor'}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
