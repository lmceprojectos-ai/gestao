'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, Trash2, X, Upload, Eye, Search, Loader2, CheckCircle2, Pencil, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';

const CATEGORIAS_CAIXA: Record<string, string> = { vendas: 'Vendas', compras: 'Compras', servicos: 'Serviços', reembolso: 'Reembolso', levantamento: 'Levantamento', outro: 'Outro' };
// Escolhe a conta bancária do talão: primeiro pelos últimos dígitos do IBAN,
// depois pelo nome do banco (aceita siglas: CGD, Montepio, BCP, ...).
const SIGLAS: Record<string, string[]> = {
  cgd: ['caixa geral', 'cgd'], montepio: ['montepio', 'mg'], bcp: ['millennium', 'bcp'],
  santander: ['santander'], novobanco: ['novo banco', 'novobanco'], bpi: ['bpi'], ca: ['credito agricola', 'crédito agrícola', 'ca'],
};
function sem(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function contaDoTalao(contas: any[], banco?: string | null, digitos?: string | null) {
  const ativas = contas.filter((c) => c.ativa !== false);
  const dig = (digitos || '').replace(/\D/g, '');
  if (dig.length >= 3) {
    const porIban = ativas.filter((c) => (c.iban || '').replace(/\D/g, '').endsWith(dig));
    if (porIban.length === 1) return porIban[0];
  }
  const b = sem(banco || '');
  if (!b) return null;
  const grupo = Object.values(SIGLAS).find((ns) => ns.some((n) => n.length > 2 ? b.includes(sem(n)) : b.split(/\W+/).includes(n)));
  const bate = (c: any) => {
    const t = sem(`${c.banco} ${c.nome}`);
    return grupo ? grupo.some((n) => (n.length > 2 ? t.includes(sem(n)) : t.split(/\W+/).includes(n))) : t.includes(b) || b.includes(sem(c.banco));
  };
  const achadas = ativas.filter(bate);
  return achadas.length >= 1 ? achadas[0] : null;
}

const EMPTY_FORM = { descricao: '', valor: '', data: '', tipo: 'entrada' as 'entrada' | 'saida', categoria: 'vendas', notas: '', contaBancariaId: '' };

export default function CaixaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contas, setContas] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => { try { const r = await fetch('/api/caixa'); const d = await r.json(); setItems(d); } catch {} finally { setLoading(false); } };
  const loadContas = async () => { try { const r = await fetch('/api/contas'); const d = await r.json(); setContas(Array.isArray(d) ? d : []); } catch {} };
  useEffect(() => { load(); loadContas(); }, []);

  const saldo = items.reduce((acc, i) => acc + (i.tipo === 'entrada' ? i.valor : -i.valor), 0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    setSelectedFile(file);
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setOcrLoading(true); setOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'caixa');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        const o = d?.success ? d.data : null;
        if (o) {
          const conta = contaDoTalao(contas, o.banco, o.conta);
          const levantamento = o.operacao === 'levantamento';
          const deposito = o.operacao === 'deposito';
          setForm(prev => ({
            ...prev,
            descricao: o.descricao || (levantamento ? `Levantamento${o.banco ? ` ${o.banco}` : ''}` : prev.descricao),
            ...(o.valor && { valor: String(o.valor) }),
            ...(o.data && { data: o.data }),
            ...(levantamento && { tipo: 'entrada' as const, categoria: 'levantamento' }),
            ...(deposito && { tipo: 'saida' as const }),
            ...(conta && { contaBancariaId: conta.id }),
          }));
          setOcrDone(true);
          toast.success(o.banco ? (conta ? `Dados extraídos · banco: ${conta.nome}` : `Dados extraídos · banco "${o.banco}" não encontrado nas contas`) : 'Dados extraídos do documento');
        } else {
          toast.error(d?.error ? `Não foi possível ler o talão: ${d.error}` : 'Não foi possível ler o talão');
        }
      } catch { toast.error('Não foi possível ler o talão'); } finally { setOcrLoading(false); }
    }
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return; }
    setUploading(true);
    try {
      let cloudStoragePath = editing?.cloudStoragePath || null;
      let contentType = editing?.contentType || null;
      let nomeOriginal = editing?.nomeOriginal || null;
      if (selectedFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, isPublic: false }) });
        const pres = await presRes.json();
        const putRes = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
        if (!putRes.ok) throw new Error('upload');
        cloudStoragePath = pres.cloud_storage_path;
        contentType = selectedFile.type;
        nomeOriginal = selectedFile.name;
      }
      const body = { ...form, valor: parseFloat(form.valor) || 0, cloudStoragePath, contentType, nomeOriginal };
      const url = editing ? `/api/caixa/${editing.id}` : '/api/caixa';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(editing ? 'Movimento atualizado' : 'Movimento registado');
      setShowModal(false); setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setOcrDone(false); load();
    } catch { toast.error('Erro ao guardar'); } finally { setUploading(false); }
  };

  const handleDelete = (id: string) => setDeleteId(id);
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/caixa/${deleteId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast.success('Movimento eliminado');
    } catch { toast.error('Erro ao eliminar o movimento'); }
    finally { setDeleting(false); setDeleteId(null); load(); }
  };
  const openEdit = (item: any) => { setEditing(item); setForm({ descricao: item.descricao || '', valor: String(item.valor || ''), data: item.data ? new Date(item.data).toISOString().split('T')[0] : '', tipo: item.tipo || 'entrada', categoria: item.categoria || 'vendas', notas: item.notas || '', contaBancariaId: item.contaBancariaId || '' }); setSelectedFile(null); setOcrDone(false); setShowModal(true); };
  const openNew = () => { setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setOcrDone(false); setShowModal(true); };
  const openPreview = async (id: string) => { try { const r = await fetch(`/api/caixa/${id}`); const d = await r.json(); if (d.url) setPreviewUrl(d.url); else toast.error('Sem documento'); } catch { toast.error('Erro'); } };

  const filtered = items.filter(i => !search || i.descricao?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Caixa" description="Controlo de caixa - entradas e saídas" icon={Wallet} action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Novo Movimento</button>} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4"><div className="text-sm text-muted-foreground">Entradas</div><div className="text-2xl font-bold text-green-600">{formatCurrency(items.filter(i => i.tipo === 'entrada').reduce((a: number, i: any) => a + i.valor, 0))}</div></div>
        <div className="card p-4"><div className="text-sm text-muted-foreground">Saídas</div><div className="text-2xl font-bold text-red-600">{formatCurrency(items.filter(i => i.tipo === 'saida').reduce((a: number, i: any) => a + i.valor, 0))}</div></div>
        <div className="card p-4"><div className="text-sm text-muted-foreground">Saldo</div><div className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(saldo)}</div></div>
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="input pl-10 w-full" /></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <EmptyState icon={Wallet} title="Sem movimentos" description="Registe o primeiro movimento" /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-center p-3 w-10"></th><th className="text-left p-3">Descrição</th><th className="text-left p-3">Categoria</th><th className="text-left p-3">Banco</th><th className="text-left p-3">Data</th><th className="text-right p-3">Valor</th><th className="text-center p-3">Ações</th></tr></thead><tbody>
          {filtered.map(item => (<tr key={item.id} className="border-b hover:bg-muted/30 transition-colors"><td className="p-3 text-center">{item.tipo === 'entrada' ? <ArrowUpCircle className="h-5 w-5 text-green-500 inline" /> : <ArrowDownCircle className="h-5 w-5 text-red-500 inline" />}</td><td className="p-3 font-medium">{item.descricao}{item.criadoPor && <span className="block text-[11px] font-normal text-muted-foreground/70">por {item.criadoPor}</span>}</td><td className="p-3">{CATEGORIAS_CAIXA[item.categoria] || item.categoria || '-'}</td><td className="p-3">{item.contaBancaria?.nome ? <span className="text-xs">{item.contaBancaria.nome}<span className="block text-[11px] text-muted-foreground/70">{item.contaBancaria.banco}</span></span> : <span className="text-muted-foreground">-</span>}</td><td className="p-3">{item.data ? formatDate(item.data) : '-'}</td><td className={`p-3 text-right font-medium ${item.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{item.tipo === 'entrada' ? '+' : '-'}{formatCurrency(item.valor)}</td><td className="p-3 text-center"><div className="flex justify-center gap-1">{item.cloudStoragePath && <button onClick={() => openPreview(item.id)} className="p-1.5 rounded-lg hover:bg-muted"><Eye className="h-4 w-4" /></button>}<button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button></div></td></tr>))}
        </tbody></table></div></div>
      )}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{editing ? 'Editar' : 'Novo'} Movimento</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div><label className="label">Descrição *</label><input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="input w-full" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Tipo</label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value as any})} className="input w-full"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div><div><label className="label">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Categoria</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} className="input w-full">{Object.entries(CATEGORIAS_CAIXA).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label className="label">Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="input w-full" /></div></div>
          <div><label className="label">Banco (origem/destino do dinheiro)</label><select value={form.contaBancariaId} onChange={e => setForm({...form, contaBancariaId: e.target.value})} className="input w-full"><option value="">Só Caixa</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}</select><p className="text-xs text-muted-foreground mt-1">Ex.: num levantamento, indique de que conta bancária saiu o dinheiro. Serve apenas para registo/consulta — não altera o saldo do banco.</p></div>
          <div><label className="label">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input w-full" rows={2} /></div>
          <div><label className="label">Documento</label><div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>{ocrLoading ? <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" />A ler documento...</div> : ocrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Dados extraídos • {selectedFile?.name}</div> : selectedFile ? <span className="text-sm">{selectedFile.name}</span> : <div className="flex flex-col items-center gap-1"><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregar documento</span></div>}</div><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={uploading} className="btn-primary flex items-center gap-2">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar' : 'Registar'}</button></div>
      </motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Documento</h3><div className="flex gap-2"><a href={previewUrl} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Download</a><button onClick={() => setPreviewUrl(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl} /></div>
      </motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{deleteId && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deleting && setDeleteId(null)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3"><div className="p-2 rounded-lg bg-red-100 text-red-600"><Trash2 className="h-5 w-5" /></div><div><h3 className="text-lg font-semibold">Eliminar movimento?</h3><p className="text-sm text-muted-foreground mt-1">Esta ação não pode ser anulada.</p></div></div>
        <div className="flex justify-end gap-2 mt-6"><button onClick={() => setDeleteId(null)} disabled={deleting} className="btn-secondary">Cancelar</button><button onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}Eliminar</button></div>
      </motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}