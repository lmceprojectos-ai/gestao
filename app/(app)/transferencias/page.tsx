'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Plus, Trash2, X, Search, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';

const EMPTY_FORM = { descricao: '', valor: '', data: '', contaOrigemId: '', contaDestinoId: '' };

export default function TransferenciasPage() {
  const [items, setItems] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch('/api/movimentos/detectar-transferencias', { method: 'POST' });
      const data = await res.json();
      if (data?.success) {
        const msgs: string[] = [];
        if (data.converted > 0) msgs.push(`${data.converted} transferência(s) interna(s)`);
        if (data.emprestimos > 0) msgs.push(`${data.emprestimos} empréstimo(s) de sócio`);
        if (msgs.length > 0) {
          toast.success(`Detetados: ${msgs.join(', ')}`);
          load();
        } else {
          toast.info(`${data.checked} movimentos analisados — nenhuma transferência detetada`);
        }
      } else {
        toast.error(data?.error || 'Erro');
      }
    } catch { toast.error('Erro ao detetar'); } finally { setDetecting(false); }
  };

  const load = async () => {
    try {
      const [r1, r2] = await Promise.all([fetch('/api/transferencias'), fetch('/api/contas')]);
      setItems(await r1.json());
      const c = await r2.json();
      setContas(Array.isArray(c) ? c.filter((x: any) => x.ativa !== false) : []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.valor || !form.contaOrigemId || !form.contaDestinoId) { toast.error('Preencha valor e ambas as contas'); return; }
    if (form.contaOrigemId === form.contaDestinoId) { toast.error('Contas devem ser diferentes'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor: parseFloat(form.valor) || 0 }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error); }
      toast.success('Transferência registada');
      setShowModal(false); setForm({...EMPTY_FORM}); load();
    } catch (e: any) { toast.error(e.message || 'Erro'); } finally { setSaving(false); }
  };

  const filtered = items.filter((i: any) => !search || i.descricao?.toLowerCase().includes(search.toLowerCase()) || i.contaOrigem?.nome?.toLowerCase().includes(search.toLowerCase()) || i.contaDestino?.nome?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Movimentos Bancários Internos" description="Transferências internas entre contas bancárias" icon={ArrowLeftRight} action={<div className="flex gap-2"><button onClick={handleDetect} disabled={detecting} className="flex items-center gap-2 px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">{detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Detetar nos Movimentos</button><button onClick={() => { setForm({...EMPTY_FORM}); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Nova Transferência</button></div>} />
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="input pl-10 w-full" /></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <EmptyState icon={ArrowLeftRight} title="Sem movimentos internos" description="Registe a primeira transferência entre contas" /> : (
        <div className="card overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Data</th><th className="text-left p-3">Descrição</th><th className="text-left p-3">De</th><th className="text-left p-3">Para</th><th className="text-right p-3">Valor</th></tr></thead><tbody>
          {filtered.map((item: any) => (<tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
            <td className="p-3">{formatDate(item.data)}</td>
            <td className="p-3 font-medium">{item.descricao || 'Transferência interna'}{item.criadoPor && <span className="block text-[11px] font-normal text-muted-foreground/70">Registado por {item.criadoPor}</span>}</td>
            <td className="p-3"><span className="inline-flex items-center gap-1 text-red-600">← {item.contaOrigem?.nome || '?'}</span></td>
            <td className="p-3"><span className="inline-flex items-center gap-1 text-green-600">→ {item.contaDestino?.nome || '?'}</span></td>
            <td className="p-3 text-right font-bold">{formatCurrency(item.valor)}</td>
          </tr>))}
        </tbody></table></div>
      )}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Nova Transferência</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div><label className="label">Descrição</label><input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Transferência para conta poupança" className="input w-full" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Conta Origem *</label><select value={form.contaOrigemId} onChange={e => setForm({...form, contaOrigemId: e.target.value})} className="input w-full"><option value="">-- Selecionar --</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}</select></div>
            <div><label className="label">Conta Destino *</label><select value={form.contaDestinoId} onChange={e => setForm({...form, contaDestinoId: e.target.value})} className="input w-full"><option value="">-- Selecionar --</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="input w-full" /></div><div><label className="label">Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="input w-full" /></div></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Transferir</button></div>
      </motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
