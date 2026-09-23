'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Plus, Edit2, Trash2, X, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';

export default function ContasPage() {
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', banco: '', iban: '', saldoInicial: '', saldoAtual: '', dataSaldoInicial: '' });
  const [recalculando, setRecalculando] = useState(false);

  const loadContas = () => {
    fetch('/api/contas').then((r) => r.json()).then((d: any) => setContas(d ?? [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadContas(); }, []);

  const openNew = () => { setEditing(null); setForm({ nome: '', banco: '', iban: '', saldoInicial: '', saldoAtual: '', dataSaldoInicial: '' }); setShowModal(true); };
  const openEdit = (conta: any) => { setEditing(conta); setForm({ nome: conta?.nome ?? '', banco: conta?.banco ?? '', iban: conta?.iban ?? '', saldoInicial: String(conta?.saldoInicial ?? 0), saldoAtual: String(conta?.saldoAtual ?? 0), dataSaldoInicial: conta?.dataSaldoInicial ? String(conta.dataSaldoInicial).slice(0, 10) : '' }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing ? `/api/contas/${editing.id}` : '/api/contas';
      const method = editing ? 'PUT' : 'POST';
      const body = editing
        ? { nome: form.nome, banco: form.banco, iban: form.iban, saldoInicial: Number(form.saldoInicial), saldoAtual: Number(form.saldoAtual), dataSaldoInicial: form.dataSaldoInicial || null }
        : { nome: form.nome, banco: form.banco, iban: form.iban, saldoInicial: Number(form.saldoInicial), dataSaldoInicial: form.dataSaldoInicial || null };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success(editing ? 'Conta atualizada' : 'Conta criada');
      setShowModal(false);
      loadContas();
    } catch { toast.error('Erro de rede'); }
  };

  const handleRecalcular = async () => {
    if (!confirm('Recalcular o saldo de todas as contas a partir do saldo inicial e dos movimentos pagos (recebimentos, pagamentos, despesas e transferências)? Esta ação corrige eventuais desvios acumulados.')) return;
    setRecalculando(true);
    try {
      const res = await fetch('/api/contas/recalcular', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { toast.error(d?.error ?? 'Erro ao recalcular'); return; }
      const alteradas = (d?.contas ?? []).filter((c: any) => Math.abs((c?.saldoNovo ?? 0) - (c?.saldoAnterior ?? 0)) > 0.001);
      if (alteradas.length === 0) toast.success('Saldos recalculados. Estavam todos corretos.');
      else toast.success(`Saldos recalculados. ${alteradas.length} conta(s) atualizada(s).`);
      loadContas();
    } catch { toast.error('Erro de rede'); } finally { setRecalculando(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que quer eliminar esta conta? Os recebimentos e pagamentos associados serão desassociados.')) return;
    try {
      const res = await fetch(`/api/contas/${id}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); toast.error(data?.error || 'Erro ao eliminar'); return; }
      toast.success('Conta eliminada');
      loadContas();
    } catch { toast.error('Erro'); }
  };

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} title="Contas Bancárias" description="Gerir as contas bancárias da empresa" action={<div className="flex items-center gap-2"><button onClick={handleRecalcular} disabled={recalculando} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${recalculando ? 'animate-spin' : ''}`} />Recalcular saldo</button><button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="h-4 w-4" />Nova Conta</button></div>} />

      {(contas?.length ?? 0) === 0 ? (
        <EmptyState icon={Landmark} title="Sem contas" description="Crie a primeira conta bancária." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((conta: any, idx: number) => (
            <motion.div key={conta?.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Landmark className="h-5 w-5 text-primary" /></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(conta)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => handleDelete(conta?.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-foreground">{conta?.nome}</h3>
              <p className="text-sm text-muted-foreground">{conta?.banco}</p>
              {conta?.iban && <p className="text-xs text-muted-foreground font-mono mt-1">{conta?.iban}</p>}
              <p className="text-2xl font-bold font-mono mt-3">{formatCurrency(conta?.saldoAtual)}</p>
              <p className="text-xs text-muted-foreground">Saldo de referência: {formatCurrency(conta?.saldoInicial)}{conta?.dataSaldoInicial ? ` (${formatDate(conta.dataSaldoInicial)})` : ''}</p>
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              <div><label className="block text-sm font-medium mb-1">Banco *</label><input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              <div><label className="block text-sm font-medium mb-1">IBAN</label><input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div><label className="block text-sm font-medium mb-1">Saldo de referência (€)</label><input type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /><p className="text-xs text-muted-foreground mt-1">Saldo real do banco na data indicada abaixo. Os movimentos posteriores a essa data ajustam o saldo atual.</p></div>
              <div><label className="block text-sm font-medium mb-1">Data do saldo de referência</label><input type="date" value={form.dataSaldoInicial} onChange={(e) => setForm({ ...form, dataSaldoInicial: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /><p className="text-xs text-muted-foreground mt-1">Deixe em branco para contar todos os movimentos desde o saldo inicial.</p></div>
              {editing && <div><label className="block text-sm font-medium mb-1">Saldo atual (€)</label><input type="number" step="0.01" value={form.saldoAtual} onChange={(e) => setForm({ ...form, saldoAtual: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /><p className="text-xs text-muted-foreground mt-1">Normalmente calculado automaticamente. Use "Recalcular saldo" para atualizar.</p></div>}
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90">{editing ? 'Guardar' : 'Criar Conta'}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
