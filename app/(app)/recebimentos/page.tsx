'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownCircle, Plus, Edit2, Trash2, X, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate, formatDateInput } from '@/lib/format';
import { EstadoBadge } from '@/components/estado-badge';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { useConfig } from '@/hooks/use-config';

export default function RecebimentosPage() {
  const { items: formasPagamento } = useConfig('forma_pagamento');
  const { items: estados } = useConfig('estado');
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ descricao: '', valor: '', dataRecebimento: '', estado: 'pendente', metodoPagamento: '', referencia: '', notas: '', clienteId: '', contaBancariaId: '' });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data');

  const load = async () => {
    try {
      const [r, c, co] = await Promise.all([fetch('/api/recebimentos').then((x) => x.json()), fetch('/api/clientes').then((x) => x.json()), fetch('/api/contas').then((x) => x.json())]);
      setItems(r ?? []); setClientes(c ?? []); setContas(co ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ descricao: '', valor: '', dataRecebimento: '', estado: 'pendente', metodoPagamento: '', referencia: '', notas: '', clienteId: '', contaBancariaId: '' }); setShowModal(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ descricao: r?.descricao ?? '', valor: String(r?.valor ?? ''), dataRecebimento: formatDateInput(r?.dataRecebimento), estado: r?.estado ?? 'pendente', metodoPagamento: r?.metodoPagamento ?? '', referencia: r?.referencia ?? '', notas: r?.notas ?? '', clienteId: r?.clienteId ?? '', contaBancariaId: r?.contaBancariaId ?? '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing ? `/api/recebimentos/${editing.id}` : '/api/recebimentos';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success(editing ? 'Recebimento atualizado' : 'Recebimento criado');
      setShowModal(false); load();
    } catch { toast.error('Erro de rede'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza?')) return;
    await fetch(`/api/recebimentos/${id}`, { method: 'DELETE' });
    toast.success('Recebimento eliminado'); load();
  };

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={ArrowDownCircle} title="Recebimentos" description="Registar e gerir recebimentos de clientes" action={<button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"><Plus className="h-4 w-4" />Novo Recebimento</button>} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por descrição, cliente, valor..." className="w-full pl-10 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary outline-none" /></div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground">
          <option value="data">Ordenar: Data de recebimento</option>
          <option value="atualizacao">Ordenar: Última atualização</option>
          <option value="valor_desc">Ordenar: Valor (maior primeiro)</option>
          <option value="valor_asc">Ordenar: Valor (menor primeiro)</option>
        </select>
      </div>

      {(() => { const filtered = items.filter(r => { if (!search) return true; const s = search.toLowerCase(); return r?.descricao?.toLowerCase().includes(s) || r?.cliente?.nome?.toLowerCase().includes(s) || r?.referencia?.toLowerCase().includes(s) || String(r?.valor)?.includes(s); }); const ts = (x: any) => x ? new Date(x).getTime() : 0; const sorted = [...filtered].sort((a: any, b: any) => { if (sortBy === 'atualizacao') return ts(b?.updatedAt) - ts(a?.updatedAt); if (sortBy === 'valor_desc') return Number(b?.valor ?? 0) - Number(a?.valor ?? 0); if (sortBy === 'valor_asc') return Number(a?.valor ?? 0) - Number(b?.valor ?? 0); return ts(b?.dataRecebimento) - ts(a?.dataRecebimento) || ts(b?.createdAt) - ts(a?.createdAt); }); return filtered.length === 0 ? <EmptyState icon={ArrowDownCircle} title="Sem recebimentos" description={search ? 'Nenhum resultado encontrado.' : 'Registe o primeiro recebimento.'} /> : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Descrição</th><th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cliente</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Data</th><th className="text-right px-4 py-3 font-medium">Valor</th><th className="text-center px-4 py-3 font-medium">Estado</th><th className="text-right px-4 py-3 font-medium">Ações</th></tr></thead>
              <tbody>
                {sorted.map((r: any, idx: number) => (
                  <motion.tr key={r?.id} initial={false} animate={{ opacity: 1 }} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r?.descricao}{r?.criadoPor && <span className="block text-[11px] font-normal text-muted-foreground/70">por {r.criadoPor}</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r?.cliente?.nome ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(r?.dataRecebimento)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(r?.valor)}</td>
                    <td className="px-4 py-3 text-center"><EstadoBadge estado={r?.estado} /></td>
                    <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button><button onClick={() => handleDelete(r?.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ); })()}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Recebimento' : 'Novo Recebimento'}</h2><button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Descrição *</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Valor (€) *</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
                <div><label className="block text-sm font-medium mb-1">Data *</label><input type="date" value={form.dataRecebimento} onChange={(e) => setForm({ ...form, dataRecebimento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{estados.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Método</label><select value={form.metodoPagamento} onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Não definido</option>{formasPagamento.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Cliente</label><select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem cliente</option>{(clientes ?? []).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Conta Bancária</label><select value={form.contaBancariaId} onChange={(e) => setForm({ ...form, contaBancariaId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem conta</option>{(contas ?? []).filter((c: any) => c?.ativa).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome} - {c?.banco}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Referência</label><input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div><label className="block text-sm font-medium mb-1">Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground resize-none" /></div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700">{editing ? 'Guardar' : 'Criar Recebimento'}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
