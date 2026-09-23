'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, Trash2, X, Upload, Search, Loader2, CheckCircle2, Pencil, Download, Camera, FileText } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { EstadoBadge } from '@/components/estado-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';

const TIPO_SEGURO: Record<string, string> = { recheio: 'Seguro de Recheio', vida: 'Seguro de Vida', saude: 'Seguro de Saúde', acidentes_trabalho: 'Seguro de Acidentes de Trabalho', viaturas: 'Seguro de Viaturas' };
const PERIODICIDADE: Record<string, string> = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
const EMPTY_FORM = { tipo: 'recheio', descricao: '', seguradora: '', apolice: '', valor: '', periodicidade: 'anual', dataInicio: '', dataEmissao: '', dataPagamento: '', estado: 'pendente', referencia: '', notas: '', entidadeNome: '', entidadeNif: '' };

export default function SegurosPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data_desc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewUrl2, setPreviewUrl2] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Comprovativo de pagamento
  const [comprovativoFile, setComprovativoFile] = useState<File | null>(null);
  const [compOcrLoading, setCompOcrLoading] = useState(false);
  const [compOcrDone, setCompOcrDone] = useState(false);
  const compFileRef = useRef<HTMLInputElement>(null);

  const load = async () => { try { const r = await fetch('/api/seguros'); const d = await r.json(); setItems(Array.isArray(d) ? d : []); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);

  const proceedWithDocFile = async (file: File) => {
    setSelectedFile(file);
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setOcrLoading(true); setOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'fatura');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        if (d?.success && d?.data) {
          setForm(prev => ({
            ...prev,
            ...(d.data.descricao && { descricao: d.data.descricao }),
            ...(d.data.valor && { valor: String(d.data.valor) }),
            ...(d.data.numero && { referencia: d.data.numero }),
            ...(d.data.data && { dataEmissao: d.data.data }),
            ...(d.data.fornecedor && { seguradora: d.data.fornecedor }),
            ...(d.data.fornecedor && { entidadeNome: d.data.fornecedor }),
            ...(d.data.nif && { entidadeNif: d.data.nif }),
          }));
          setOcrDone(true); toast.success('Dados extraídos da apólice');
        }
      } catch {} finally { setOcrLoading(false); }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); proceedWithDocFile(c); } });
    } else { proceedWithDocFile(file); }
  };

  const proceedWithCompFile = async (file: File) => {
    setComprovativoFile(file);
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setCompOcrLoading(true); setCompOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'comprovativo');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        if (d?.success && d?.data) {
          setForm(prev => ({
            ...prev,
            ...(d.data.data && { dataPagamento: d.data.data }),
            ...(d.data.referencia && !prev.referencia && { referencia: d.data.referencia }),
            estado: 'pago',
          }));
          setCompOcrDone(true); toast.success('Comprovativo lido - estado alterado para Pago');
        }
      } catch {} finally { setCompOcrLoading(false); }
    }
  };

  const handleComprovativoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); proceedWithCompFile(c); } });
    } else { proceedWithCompFile(file); }
  };

  const handleSave = async () => {
    if (!form.tipo || !form.valor) { toast.error('Preencha tipo e valor'); return; }
    setUploading(true);
    try {
      let cloudStoragePath = editing?.cloudStoragePath || null;
      let contentType = editing?.contentType || null;
      let nomeOriginal = editing?.nomeOriginal || null;
      if (selectedFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
        cloudStoragePath = pres.cloud_storage_path;
        contentType = selectedFile.type;
        nomeOriginal = selectedFile.name;
      }
      let comprovativoPath = editing?.comprovativoPath || null;
      let comprovativoContentType = editing?.comprovativoContentType || null;
      let comprovativoOriginal = editing?.comprovativoOriginal || null;
      if (comprovativoFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: comprovativoFile.name, contentType: comprovativoFile.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': comprovativoFile.type }, body: comprovativoFile });
        comprovativoPath = pres.cloud_storage_path;
        comprovativoContentType = comprovativoFile.type;
        comprovativoOriginal = comprovativoFile.name;
      }
      const body = { ...form, valor: parseFloat(form.valor) || 0, cloudStoragePath, contentType, nomeOriginal, comprovativoPath, comprovativoContentType, comprovativoOriginal };
      const url = editing ? `/api/seguros/${editing.id}` : '/api/seguros';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(editing ? 'Seguro atualizado' : 'Seguro registado');
      setShowModal(false); setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setComprovativoFile(null); setOcrDone(false); setCompOcrDone(false); load();
    } catch { toast.error('Erro ao guardar'); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Eliminar?')) return; await fetch(`/api/seguros/${id}`, { method: 'DELETE' }); toast.success('Eliminado'); load(); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ tipo: item.tipo || 'recheio', descricao: item.descricao || '', seguradora: item.seguradora || '', apolice: item.apolice || '', valor: String(item.valor || ''), periodicidade: item.periodicidade || 'anual', dataInicio: item.dataInicio ? new Date(item.dataInicio).toISOString().split('T')[0] : '', dataEmissao: item.dataEmissao ? new Date(item.dataEmissao).toISOString().split('T')[0] : '', dataPagamento: item.dataPagamento ? new Date(item.dataPagamento).toISOString().split('T')[0] : '', estado: item.estado || 'pendente', referencia: item.referencia || '', notas: item.notas || '', entidadeNome: item.entidadeNome || '', entidadeNif: item.entidadeNif || '' });
    setSelectedFile(null); setComprovativoFile(null); setOcrDone(false); setCompOcrDone(false); setShowModal(true);
  };
  const openNew = () => { setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setComprovativoFile(null); setOcrDone(false); setCompOcrDone(false); setShowModal(true); };
  const openPreview = async (id: string, field: 'doc' | 'comp') => {
    try {
      const r = await fetch(`/api/seguros/${id}`); const d = await r.json();
      const u = field === 'comp' ? d.comprovativoUrl : d.url;
      if (u) { if (field === 'comp') setPreviewUrl2(u); else setPreviewUrl(u); }
      else toast.error('Sem documento');
    } catch { toast.error('Erro'); }
  };

  const filtered = items.filter(i => !search || i.tipo?.toLowerCase().includes(search.toLowerCase()) || i.descricao?.toLowerCase().includes(search.toLowerCase()) || i.seguradora?.toLowerCase().includes(search.toLowerCase()) || i.apolice?.toLowerCase().includes(search.toLowerCase()));
  const ts = (x: any) => x ? new Date(x).getTime() : 0;
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'data_asc') return ts(a.dataEmissao) - ts(b.dataEmissao);
    if (sortBy === 'seguradora') return (a.seguradora || '').localeCompare(b.seguradora || '', 'pt', { sensitivity: 'base' });
    return ts(b.dataEmissao) - ts(a.dataEmissao);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Seguros" description="Gestão de apólices e seguros da empresa" icon={ShieldCheck} action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Novo Seguro</button>} />
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="input pl-10 w-full" /></div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input sm:w-56"><option value="data_desc">Emissão (mais recente)</option><option value="data_asc">Emissão (mais antigo)</option><option value="seguradora">Seguradora (A-Z)</option></select>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <EmptyState icon={ShieldCheck} title="Sem seguros" description="Registe o primeiro seguro" /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Tipo</th><th className="text-left p-3 hidden sm:table-cell">Seguradora</th><th className="text-left p-3 hidden md:table-cell">Apólice</th><th className="text-left p-3 hidden lg:table-cell">Periodicidade</th><th className="text-right p-3">Valor</th><th className="text-left p-3 hidden md:table-cell">Emissão</th><th className="text-center p-3">Estado</th><th className="text-center p-3">Docs</th><th className="text-center p-3">Ações</th></tr></thead><tbody>
          {sorted.map(item => (<tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
            <td className="p-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{TIPO_SEGURO[item.tipo] || item.tipo}</span>{item.descricao && <span className="block text-[11px] text-muted-foreground/70 mt-0.5">{item.descricao}</span>}</td>
            <td className="p-3 hidden sm:table-cell text-muted-foreground">{item.seguradora || '-'}</td>
            <td className="p-3 hidden md:table-cell">{item.apolice || '-'}</td>
            <td className="p-3 hidden lg:table-cell">{PERIODICIDADE[item.periodicidade] || item.periodicidade || '-'}</td>
            <td className="p-3 text-right font-medium">{formatCurrency(item.valor)}</td>
            <td className="p-3 hidden md:table-cell">{item.dataEmissao ? formatDate(item.dataEmissao) : '-'}</td>
            <td className="p-3 text-center"><EstadoBadge estado={item.estado} /></td>
            <td className="p-3 text-center">
              <div className="flex justify-center gap-1">
                {item.cloudStoragePath && <button onClick={() => openPreview(item.id, 'doc')} className="p-1 rounded hover:bg-muted" title="Ver apólice/documento"><FileText className="h-3.5 w-3.5 text-blue-600" /></button>}
                {item.comprovativoPath && <button onClick={() => openPreview(item.id, 'comp')} className="p-1 rounded hover:bg-muted" title="Ver comprovativo"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></button>}
              </div>
            </td>
            <td className="p-3 text-center"><div className="flex justify-center gap-1"><button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>))}
        </tbody></table></div></div>
      )}

      {/* Modal Criar/Editar */}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{editing ? 'Editar' : 'Novo'} Seguro</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Tipo *</label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="input w-full">{Object.entries(TIPO_SEGURO).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label className="label">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="input w-full" /></div></div>
          <div><label className="label">Descrição</label><input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Viatura Renault Clio 00-AA-00" className="input w-full" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Seguradora</label><input value={form.seguradora} onChange={e => setForm({...form, seguradora: e.target.value})} placeholder="Nome da seguradora" className="input w-full" /></div>
            <div><label className="label">Nº Apólice</label><input value={form.apolice} onChange={e => setForm({...form, apolice: e.target.value})} className="input w-full" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Periodicidade</label><select value={form.periodicidade} onChange={e => setForm({...form, periodicidade: e.target.value})} className="input w-full">{Object.entries(PERIODICIDADE).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label className="label">Referência</label><input value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-3 gap-3"><div><label className="label">Data Início</label><input type="date" value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} className="input w-full" /></div><div><label className="label">Data Emissão</label><input type="date" value={form.dataEmissao} onChange={e => setForm({...form, dataEmissao: e.target.value})} className="input w-full" /></div><div><label className="label">Data Pagamento</label><input type="date" value={form.dataPagamento} onChange={e => setForm({...form, dataPagamento: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Estado</label><select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} className="input w-full"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div><div><label className="label">NIF Entidade</label><input value={form.entidadeNif} onChange={e => setForm({...form, entidadeNif: e.target.value})} className="input w-full" /></div></div>
          <div><label className="label">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input w-full" rows={2} /></div>

          {/* Documento / Apólice */}
          <div className="border rounded-lg p-3 space-y-2">
            <label className="label flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" />Apólice / Documento do Seguro</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
              {ocrLoading ? <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" />A ler documento...</div>
              : ocrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Dados extraídos • {selectedFile?.name}</div>
              : selectedFile ? <span className="text-sm">{selectedFile.name}</span>
              : editing?.cloudStoragePath ? <span className="text-sm text-muted-foreground">Documento já anexado • Clique para substituir</span>
              : <div className="flex flex-col items-center gap-1"><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Digitalizar apólice do seguro</span></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Comprovativo de Pagamento */}
          <div className="border rounded-lg p-3 space-y-2">
            <label className="label flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />Comprovativo de Pagamento (opcional)</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-green-300 transition-colors" onClick={() => compFileRef.current?.click()}>
              {compOcrLoading ? <div className="flex items-center justify-center gap-2 text-green-600"><Loader2 className="h-5 w-5 animate-spin" />A ler comprovativo...</div>
              : compOcrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Comprovativo lido • {comprovativoFile?.name}</div>
              : comprovativoFile ? <span className="text-sm">{comprovativoFile.name}</span>
              : editing?.comprovativoPath ? <span className="text-sm text-muted-foreground">Comprovativo já anexado • Clique para substituir</span>
              : <div className="flex flex-col items-center gap-1"><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Digitalizar comprovativo de pagamento</span></div>}
            </div>
            <input ref={compFileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleComprovativoSelect} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={uploading} className="btn-primary flex items-center gap-2">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar' : 'Registar'}</button></div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Preview Modals */}
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Apólice / Documento</h3><div className="flex gap-2"><a href={previewUrl} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Download</a><button onClick={() => setPreviewUrl(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl} /></div>
      </motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{previewUrl2 && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl2(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Comprovativo de Pagamento</h3><div className="flex gap-2"><a href={previewUrl2} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Download</a><button onClick={() => setPreviewUrl2(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl2} /></div>
      </motion.div></motion.div>}</AnimatePresence>
      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}
    </div>
  );
}
