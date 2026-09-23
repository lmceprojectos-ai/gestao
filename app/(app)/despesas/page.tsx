'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Trash2, X, Upload, Eye, Search, Loader2, CheckCircle2, Pencil, Download, Building2, Camera, Receipt, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { EstadoBadge } from '@/components/estado-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';

const CATEGORIAS: Record<string, string> = { material: 'Material', servicos: 'Serviços', renda: 'Renda', comunicacoes: 'Comunicações', transportes: 'Transportes', seguros: 'Seguros', manutencao: 'Manutenção', marketing: 'Marketing', outro: 'Outro' };
const SUBCATEGORIAS: Record<string, string[]> = {
  material: ['Papel', 'Tintas', 'Consumíveis', 'Ferramentas', 'Outro'],
  servicos: ['Contabilidade', 'Advocacia', 'Consultoria', 'Limpeza', 'Software', 'Outro'],
  renda: ['Escritório', 'Armazém', 'Estacionamento', 'Outro'],
  comunicacoes: ['Telefone', 'Internet', 'Correios', 'Outro'],
  transportes: ['Combustível', 'Portagens', 'Manutenção Auto', 'Seguro Auto', 'Outro'],
  seguros: ['Saúde', 'Acidentes', 'Multirriscos', 'Outro'],
  manutencao: ['Equipamentos', 'Instalações', 'Informática', 'Outro'],
  marketing: ['Publicidade', 'Design', 'Impressão', 'Digital', 'Outro'],
  outro: ['Outro'],
};
const METODOS: Record<string, string> = { numerario: 'Numerário', transferencia: 'Transferência bancária', multibanco: 'Multibanco', mbway: 'MB WAY', debito_direto: 'Débito direto', cartao: 'Cartão', cheque: 'Cheque' };
const EMPTY_FORM = { descricao: '', categoria: 'material', subcategoria: '', valor: '', data: '', estado: 'pendente', fornecedorId: '', notas: '', entidadeNome: '', entidadeNif: '', metodoPagamento: '', contaBancariaId: '', seguroId: '' };

export default function DespesasPage() {
  const [items, setItems] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [seguros, setSeguros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data_desc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedComprovativo, setSelectedComprovativo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const compRef = useRef<HTMLInputElement>(null);
  // Pagamento em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkLines, setBulkLines] = useState<{ metodo: string; valor: string; contaBancariaId: string }[]>([{ metodo: 'numerario', valor: '', contaBancariaId: '' }]);
  const [bulkDataPagamento, setBulkDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [bulkComprovativos, setBulkComprovativos] = useState<File[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const bulkCompRef = useRef<HTMLInputElement>(null);
  const [comprovativosList, setComprovativosList] = useState<{ url: string; nome: string }[] | null>(null);
  // Despesas fixas em falta (alerta)
  const [emFaltaPorMes, setEmFaltaPorMes] = useState<{ ano: number; mes: number; label: string; fornecedores: { nome: string; esperado: number; contabilizadas: number; emFalta: number }[] }[]>([]);
  const [showEmFalta, setShowEmFalta] = useState(true);

  const load = async () => { try { const [r1, r2, r3, r4] = await Promise.all([fetch('/api/despesas'), fetch('/api/fornecedores'), fetch('/api/contas'), fetch('/api/seguros')]); setItems(await r1.json()); setFornecedores(await r2.json()); setContas(await r3.json()); setSeguros(await r4.json()); } catch {} finally { setLoading(false); } };
  const loadEmFalta = async () => { try { const r = await fetch('/api/dashboard'); const d = await r.json(); setEmFaltaPorMes(Array.isArray(d?.fornecedoresFixosEmFaltaPorMes) ? d.fornecedoresFixosEmFaltaPorMes : []); } catch {} };
  useEffect(() => { load(); loadEmFalta(); }, []);

  const emFaltaTotal = emFaltaPorMes.reduce((a, m) => a + (m.fornecedores ?? []).reduce((b, f) => b + (f?.emFalta ?? 0), 0), 0);

  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);

  const proceedWithFile = async (file: File) => {
    setSelectedFile(file);
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setOcrLoading(true); setOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'fatura');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        if (d?.success && d?.data) {
          const ocrData = d.data;
          const updates: any = {};
          if (ocrData.descricao) updates.descricao = ocrData.descricao;
          if (ocrData.valor) updates.valor = String(ocrData.valor);
          if (ocrData.data) updates.data = ocrData.data;
          if (ocrData.fornecedor) updates.entidadeNome = ocrData.fornecedor;
          if (ocrData.nif) updates.entidadeNif = ocrData.nif;
          if (ocrData.nif) {
            const match = fornecedores.find((f: any) => f.nif === ocrData.nif);
            if (match) updates.fornecedorId = match.id;
          }
          setForm(prev => ({ ...prev, ...updates }));
          setOcrDone(true);
          toast.success('Dados extraídos da fatura');
        }
      } catch {} finally { setOcrLoading(false); }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const cropped = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); proceedWithFile(cropped); } });
    } else {
      proceedWithFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }) });
    const pres = await presRes.json();
    const putRes = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!putRes.ok) throw new Error('upload');
    return pres.cloud_storage_path as string;
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return; }
    setUploading(true);
    try {
      let cloudStoragePath = editing?.cloudStoragePath || null;
      let contentType = editing?.contentType || null;
      let nomeOriginal = editing?.nomeOriginal || null;
      if (selectedFile) {
        cloudStoragePath = await uploadFile(selectedFile);
        contentType = selectedFile.type || null;
        nomeOriginal = selectedFile.name || null;
      }
      let comprovativoPath = editing?.comprovativoPath || null;
      let comprovativoContentType = editing?.comprovativoContentType || null;
      let comprovativoNomeOriginal = editing?.comprovativoNomeOriginal || null;
      if (selectedComprovativo) {
        comprovativoPath = await uploadFile(selectedComprovativo);
        comprovativoContentType = selectedComprovativo.type || null;
        comprovativoNomeOriginal = selectedComprovativo.name || null;
      }
      const body = { ...form, valor: parseFloat(form.valor) || 0, fornecedorId: form.fornecedorId || null, cloudStoragePath, contentType, nomeOriginal, comprovativoPath, comprovativoContentType, comprovativoNomeOriginal, entidadeNome: form.entidadeNome || null, entidadeNif: form.entidadeNif || null, subcategoria: form.subcategoria || null, metodoPagamento: form.metodoPagamento || null, contaBancariaId: form.contaBancariaId || null, seguroId: form.seguroId || null };
      const url = editing ? `/api/despesas/${editing.id}` : '/api/despesas';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(editing ? 'Despesa atualizada' : 'Despesa registada');
      setShowModal(false); setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setSelectedComprovativo(null); setOcrDone(false); load();
    } catch { toast.error('Erro ao guardar'); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Eliminar?')) return; await fetch(`/api/despesas/${id}`, { method: 'DELETE' }); toast.success('Eliminada'); load(); };
  const openEdit = (item: any) => { setEditing(item); setForm({ descricao: item.descricao || '', categoria: item.categoria || 'material', subcategoria: item.subcategoria || '', valor: String(item.valor || ''), data: item.data ? new Date(item.data).toISOString().split('T')[0] : '', estado: item.estado || 'pendente', fornecedorId: item.fornecedorId || '', notas: item.notas || '', entidadeNome: item.entidadeNome || '', entidadeNif: item.entidadeNif || '', metodoPagamento: item.metodoPagamento || '', contaBancariaId: item.contaBancariaId || '', seguroId: item.seguroId || '' }); setSelectedFile(null); setSelectedComprovativo(null); setOcrDone(false); setShowModal(true); };
  const openNew = () => { setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setSelectedComprovativo(null); setOcrDone(false); setShowModal(true); };
  const handleComprovativoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const raw = e.target.files?.[0]; if (!raw) return; const file = raw.type.startsWith('image/') ? await compressImage(raw) : raw; setSelectedComprovativo(file); };
  const openPreview = async (id: string) => { try { const r = await fetch(`/api/despesas/${id}`); const d = await r.json(); if (d.url) setPreviewUrl(d.url); else toast.error('Sem documento'); } catch { toast.error('Erro'); } };
  const openComprovativo = async (id: string) => { try { const r = await fetch(`/api/despesas/${id}`); const d = await r.json(); const lista = Array.isArray(d.comprovativos) ? d.comprovativos.filter((c: any) => c?.url) : []; if (lista.length > 1) { setComprovativosList(lista.map((c: any) => ({ url: c.url, nome: c.nome || 'Comprovativo' }))); } else if (lista.length === 1) { setPreviewUrl(lista[0].url); } else if (d.comprovativoUrl) { setPreviewUrl(d.comprovativoUrl); } else toast.error('Sem comprovativo'); } catch { toast.error('Erro'); } };

  // ----- Pagamento em lote -----
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const clearSelection = () => setSelectedIds(new Set());
  const openBulk = () => {
    const total = items.filter(i => selectedIds.has(i.id)).reduce((a, i) => a + (i.valor || 0), 0);
    setBulkLines([{ metodo: 'numerario', valor: (Math.round(total * 100) / 100).toString(), contaBancariaId: '' }]);
    setBulkDataPagamento(new Date().toISOString().split('T')[0]);
    setBulkComprovativos([]); setBulkModal(true);
  };
  const updateLine = (idx: number, patch: Partial<{ metodo: string; valor: string; contaBancariaId: string }>) => setBulkLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setBulkLines(prev => [...prev, { metodo: prev.some(l => l.metodo !== 'numerario') ? 'numerario' : 'transferencia', valor: '', contaBancariaId: '' }]);
  const removeLine = (idx: number) => setBulkLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const handleBulkCompSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const raw = e.target.files?.[0]; if (!raw) return; const file = raw.type.startsWith('image/') ? await compressImage(raw) : raw; setBulkComprovativos(prev => [...prev, file]); if (bulkCompRef.current) bulkCompRef.current.value = ''; };
  const removeBulkComprovativo = (idx: number) => setBulkComprovativos(prev => prev.filter((_, i) => i !== idx));
  const handleBulkPay = async () => {
    if (selectedIds.size === 0) { toast.error('Selecione pelo menos uma despesa'); return; }
    const linhas = bulkLines.map(l => ({ metodo: l.metodo, valor: parseFloat(l.valor) || 0, contaBancariaId: l.metodo === 'numerario' ? null : (l.contaBancariaId || null) })).filter(l => l.valor > 0);
    if (linhas.length === 0) { toast.error('Indique pelo menos um método com valor'); return; }
    setBulkSaving(true);
    try {
      const comprovativos: { path: string; contentType: string | null; nomeOriginal: string | null }[] = [];
      for (const f of bulkComprovativos) { const path = await uploadFile(f); comprovativos.push({ path, contentType: f.type || null, nomeOriginal: f.name || null }); }
      const body = { ids: Array.from(selectedIds), pagamentos: linhas, dataPagamento: bulkDataPagamento || null, comprovativos };
      const r = await fetch('/api/despesas/pagar-lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'erro');
      toast.success(`${d.count} despesa(s) marcadas como pagas`);
      setBulkModal(false); clearSelection(); load();
    } catch (e: any) { toast.error(e?.message || 'Erro ao pagar despesas'); } finally { setBulkSaving(false); }
  };
  const bulkAllocated = bulkLines.reduce((a, l) => a + (parseFloat(l.valor) || 0), 0);

  const filtered = items.filter(i => {
    return !search || i.descricao?.toLowerCase().includes(search.toLowerCase()) || i.categoria?.toLowerCase().includes(search.toLowerCase()) || i.subcategoria?.toLowerCase().includes(search.toLowerCase()) || i.entidadeNome?.toLowerCase().includes(search.toLowerCase()) || String(i.valor)?.includes(search);
  });
  const ts = (x: any) => x ? new Date(x).getTime() : 0;
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'criado_desc') return (ts(b.createdAt) - ts(a.createdAt)) || (ts(b.data) - ts(a.data));
    if (sortBy === 'data_asc') return ts(a.data) - ts(b.data);
    if (sortBy === 'entidade') return (a.entidadeNome || '').localeCompare(b.entidadeNome || '', 'pt', { sensitivity: 'base' });
    return ts(b.data) - ts(a.data);
  });
  const allSelected = sorted.length > 0 && sorted.every(i => selectedIds.has(i.id));
  const toggleSelectAll = () => { if (allSelected) { clearSelection(); } else { setSelectedIds(new Set(sorted.map(i => i.id))); } };
  const bulkTotal = items.filter(i => selectedIds.has(i.id)).reduce((a, i) => a + (i.valor || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Despesas" description="Gestão de despesas gerais" icon={ShoppingCart} action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Nova Despesa</button>} />
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="input pl-10 w-full" /></div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input sm:w-64"><option value="criado_desc">Carregadas recentemente</option><option value="data_desc">Data (mais recente)</option><option value="data_asc">Data (mais antiga)</option><option value="entidade">Entidade (A-Z)</option></select>
      </div>

      {/* Alerta de despesas fixas mensais em falta */}
      {emFaltaPorMes.length > 0 && (
        <div className="card border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 overflow-hidden">
          <button onClick={() => setShowEmFalta(v => !v)} className="w-full flex items-center gap-3 p-4 text-left">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 shrink-0"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Despesas fixas por registar</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80">{emFaltaTotal} despesa(s) fixa(s) mensal(is) ainda sem registo, em {emFaltaPorMes.length} {emFaltaPorMes.length === 1 ? 'mês' : 'meses'}.</p>
            </div>
            {showEmFalta ? <ChevronUp className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" /> : <ChevronDown className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>
          {showEmFalta && (
            <div className="px-4 pb-4 space-y-3">
              {emFaltaPorMes.map(m => (
                <div key={`${m.ano}-${m.mes}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2 capitalize">{m.label} · {(m.fornecedores ?? []).reduce((a, f) => a + (f?.emFalta ?? 0), 0)} em falta</p>
                  <div className="flex flex-wrap gap-2">
                    {(m.fornecedores ?? []).map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-800 bg-white/70 dark:bg-amber-950/40 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-3 w-3" />{f.nome}
                        {f.esperado > 1 && <span className="text-[11px] text-amber-600 dark:text-amber-400">({f.contabilizadas}/{f.esperado})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 border-t border-amber-200 dark:border-amber-900/50 pt-2">Esta é uma lista de controlo das despesas fixas recorrentes que ainda não têm documento/registo em cada mês. Não é apresentado um valor total em euros porque estas despesas fixas não têm um montante previsto guardado — o valor só é conhecido depois de registar a fatura de cada fornecedor.</p>
            </div>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-primary/40 bg-primary/5">
          <div className="text-sm"><span className="font-semibold">{selectedIds.size}</span> despesa(s) selecionada(s) · total <span className="font-semibold">{formatCurrency(bulkTotal)}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="btn-secondary text-sm">Limpar</button>
            <button onClick={openBulk} className="btn-primary flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />Marcar como pagas</button>
          </div>
        </div>
      )}
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <EmptyState icon={ShoppingCart} title="Sem despesas" description="Registe a primeira despesa" /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="p-3 w-10 text-center"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 cursor-pointer" title="Selecionar tudo" /></th><th className="text-left p-3">Modo de pagamento</th><th className="text-left p-3">Entidade</th><th className="text-left p-3">Categoria</th><th className="text-right p-3">Valor</th><th className="text-left p-3">Data</th><th className="text-center p-3">Estado</th><th className="text-center p-3">Ações</th></tr></thead><tbody>
          {sorted.map(item => (<tr key={item.id} className={`border-b hover:bg-muted/30 transition-colors ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}>
            <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4 cursor-pointer" /></td>
            <td className="p-3">
              {item.metodoPagamento ? (
                <div>
                  <div className="font-medium">{METODOS[item.metodoPagamento] || item.metodoPagamento}</div>
                  {item.contaBancaria?.nome && <div className="text-xs text-muted-foreground">{item.contaBancaria.nome}</div>}
                </div>
              ) : <span className="text-muted-foreground">-</span>}
              {item.criadoPor && <span className="block text-[11px] font-normal text-muted-foreground/70">por {item.criadoPor}</span>}
            </td>
            <td className="p-3">
              {item.entidadeNome ? (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm">{item.entidadeNome}</div>
                    {item.entidadeNif && <div className="text-xs text-muted-foreground">{item.entidadeNif}</div>}
                  </div>
                </div>
              ) : '-'}
            </td>
            <td className="p-3"><div><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{CATEGORIAS[item.categoria] || item.categoria}</span>{item.subcategoria && <div className="text-xs text-muted-foreground mt-0.5">{item.subcategoria}</div>}</div></td>
            <td className="p-3 text-right font-medium">{formatCurrency(item.valor)}</td>
            <td className="p-3">{item.data ? formatDate(item.data) : '-'}</td>
            <td className="p-3 text-center"><EstadoBadge estado={item.estado} /></td>
            <td className="p-3 text-center"><div className="flex justify-center gap-1">{item.cloudStoragePath && <button onClick={() => openPreview(item.id)} title="Ver documento" className="p-1.5 rounded-lg hover:bg-muted"><Eye className="h-4 w-4" /></button>}{(item.comprovativoPath || (Array.isArray(item.comprovativosExtra) && item.comprovativosExtra.length > 0)) && <button onClick={() => openComprovativo(item.id)} title="Ver comprovativo(s) de pagamento" className="p-1.5 rounded-lg hover:bg-muted text-green-600"><Receipt className="h-4 w-4" /></button>}<button onClick={() => openEdit(item)} title="Editar" className="p-1.5 rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(item.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>))}
        </tbody></table></div></div>
      )}

      {/* Modal Nova/Editar Despesa */}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{editing ? 'Editar' : 'Nova'} Despesa</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          {/* Documento / OCR */}
          <div><label className="label">Documento (fatura/recibo)</label><div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>{ocrLoading ? <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" />A ler documento...</div> : ocrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Dados extraídos • {selectedFile?.name}</div> : selectedFile ? <span className="text-sm">{selectedFile.name}</span> : <div className="flex flex-col items-center gap-1"><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Tirar foto ou carregar fatura</span></div>}</div><input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} /></div>

          {/* Entidade (preenchida por OCR ou manual) */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Entidade (nome)</label><input value={form.entidadeNome} onChange={e => setForm({...form, entidadeNome: e.target.value})} placeholder="Nome do emissor" className="input w-full" /></div>
            <div><label className="label">NIF</label><input value={form.entidadeNif} onChange={e => setForm({...form, entidadeNif: e.target.value})} placeholder="NIF do emissor" className="input w-full" /></div>
          </div>

          <div><label className="label">Descrição *</label><input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="input w-full" /></div>
          <div className="grid grid-cols-3 gap-3"><div><label className="label">Categoria</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value, subcategoria: ''})} className="input w-full">{Object.entries(CATEGORIAS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label className="label">Subcategoria</label><select value={form.subcategoria} onChange={e => setForm({...form, subcategoria: e.target.value})} className="input w-full"><option value="">-- Nenhuma --</option>{(SUBCATEGORIAS[form.categoria] || []).map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="label">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Data</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="input w-full" /></div><div><label className="label">Estado</label><select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} className="input w-full"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div></div>

          {/* Modo de pagamento + conta bancária */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Modo de pagamento</label><select value={form.metodoPagamento} onChange={e => setForm({...form, metodoPagamento: e.target.value})} className="input w-full"><option value="">-- Selecionar --</option>{Object.entries(METODOS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Conta bancária</label><select value={form.contaBancariaId} onChange={e => setForm({...form, contaBancariaId: e.target.value})} className="input w-full"><option value="">-- Nenhuma --</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}</select></div>
          </div>
          {form.contaBancariaId && form.estado === 'pago' && <p className="text-xs text-muted-foreground -mt-1">Esta despesa vai sair do saldo da conta selecionada.</p>}

          {/* Seguro associado (apenas para associar despesas mensais ao respetivo seguro) */}
          <div><label className="label">Seguro associado</label><select value={form.seguroId} onChange={e => setForm({...form, seguroId: e.target.value})} className="input w-full"><option value="">-- Nenhum --</option>{seguros.map((s: any) => <option key={s.id} value={s.id}>{s.seguradora}{s.apolice ? ` — Apólice ${s.apolice}` : ''}{s.tipo ? ` (${s.tipo})` : ''}</option>)}</select></div>

          {/* Comprovativo de pagamento */}
          <div><label className="label">Comprovativo de pagamento</label><div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => compRef.current?.click()}>{selectedComprovativo ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />{selectedComprovativo.name}</div> : editing?.comprovativoPath ? <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Receipt className="h-5 w-5" />Comprovativo carregado • clique para substituir</div> : <div className="flex flex-col items-center gap-1"><Receipt className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregar comprovativo (foto ou PDF)</span></div>}</div><input ref={compRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleComprovativoSelect} /></div>

          <div><label className="label">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input w-full" rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={uploading} className="btn-primary flex items-center gap-2">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar' : 'Registar'}</button></div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Modal Pagamento em lote */}
      <AnimatePresence>{bulkModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBulkModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Marcar despesas como pagas</h3><button onClick={() => setBulkModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="rounded-lg bg-muted/40 p-3 mb-4 text-sm"><span className="font-semibold">{selectedIds.size}</span> despesa(s) · total a pagar <span className="font-semibold">{formatCurrency(bulkTotal)}</span></div>
        <div className="space-y-3">
          <div>
            <label className="label">Métodos de pagamento</label>
            <p className="text-xs text-muted-foreground mb-2">Divida o valor por vários métodos — por ex. parte da caixa (dinheiro) e parte do banco. Indique o valor de cada um.</p>
            <div className="space-y-2">
              {bulkLines.map((linha, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select value={linha.metodo} onChange={e => { const v = e.target.value; updateLine(idx, { metodo: v, contaBancariaId: v === 'numerario' ? '' : linha.contaBancariaId }); }} className="input w-full"><option value="numerario">Dinheiro (caixa)</option>{Object.entries(METODOS).filter(([k]) => k !== 'numerario').map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <div className="w-32">
                      <div className="relative"><input type="number" step="0.01" min="0" value={linha.valor} onChange={e => updateLine(idx, { valor: e.target.value })} placeholder="0,00" className="input w-full pr-6" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span></div>
                    </div>
                    {bulkLines.length > 1 && <button onClick={() => removeLine(idx)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {linha.metodo !== 'numerario' && (
                    <select value={linha.contaBancariaId} onChange={e => updateLine(idx, { contaBancariaId: e.target.value })} className="input w-full"><option value="">-- Conta bancária (opcional) --</option>{contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>)}</select>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLine} className="btn-secondary text-sm mt-2 flex items-center gap-2"><Plus className="h-4 w-4" />Adicionar método</button>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total a pagar</span><span className="font-semibold">{formatCurrency(bulkTotal)}</span></div>
            <div className="flex justify-between"><span>Total distribuído</span><span className="font-semibold">{formatCurrency(bulkAllocated)}</span></div>
            {Math.abs(bulkAllocated - bulkTotal) > 0.005 && <div className="flex justify-between text-red-600"><span>Por distribuir</span><span className="font-semibold">{formatCurrency(bulkTotal - bulkAllocated)}</span></div>}
          </div>
          <div><label className="label">Data de pagamento</label><input type="date" value={bulkDataPagamento} onChange={e => setBulkDataPagamento(e.target.value)} className="input w-full" /></div>
          <div><label className="label">Comprovativos de pagamento (pode juntar vários — ex.: um por método)</label>
            {bulkComprovativos.length > 0 && <div className="space-y-1.5 mb-2">{bulkComprovativos.map((f, i) => <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"><Receipt className="h-4 w-4 text-green-600 shrink-0" /><span className="flex-1 truncate">{f.name}</span><button onClick={() => removeBulkComprovativo(i)} className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"><X className="h-4 w-4" /></button></div>)}</div>}
            <button onClick={() => bulkCompRef.current?.click()} className="w-full border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"><Plus className="h-4 w-4" />{bulkComprovativos.length > 0 ? 'Adicionar outro comprovativo' : 'Carregar comprovativo (foto ou PDF)'}</button>
            <input ref={bulkCompRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleBulkCompSelect} /></div>
          <p className="text-xs text-muted-foreground">Cada método "Dinheiro (caixa)" gera uma saída na Caixa com o valor indicado. Os saldos bancários são calculados a partir da data de referência de cada conta — se necessário, use "Recalcular saldo" nas Contas.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setBulkModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleBulkPay} disabled={bulkSaving} className="btn-primary flex items-center gap-2">{bulkSaving && <Loader2 className="h-4 w-4 animate-spin" />}Marcar {selectedIds.size} como pagas</button></div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Modal lista de comprovativos */}
      <AnimatePresence>{comprovativosList && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={() => setComprovativosList(null)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Comprovativos de pagamento</h3><button onClick={() => setComprovativosList(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-2">{comprovativosList.map((c, i) => <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Receipt className="h-4 w-4 text-green-600 shrink-0" /><span className="flex-1 truncate">{c.nome}</span><button onClick={() => setPreviewUrl(c.url)} className="btn-secondary text-xs flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Ver</button><a href={c.url} target="_blank" rel="noopener" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Download className="h-4 w-4" /></a></div>)}</div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Modal Preview */}
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Documento</h3><div className="flex gap-2"><a href={previewUrl} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Download</a><button onClick={() => setPreviewUrl(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl} /></div>
      </motion.div></motion.div>}</AnimatePresence>
      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}
    </div>
  );
}
