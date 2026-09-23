'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, X, Upload, Eye, Search, Loader2, CheckCircle2, Pencil, Download, Camera, Printer, Receipt } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { EstadoBadge } from '@/components/estado-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';

const EMPTY_FORM = { funcionario: '', valorBruto: '', valorLiquido: '', segSocial: '', irs: '', periodo: '', estado: 'pendente', notas: '', dataPagamento: '' };

export default function VencimentosPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data_desc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [comprovanteOcrLoading, setComprovanteOcrLoading] = useState(false);
  const [comprovanteOcrDone, setComprovanteOcrDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);

  const load = async () => { try { const r = await fetch('/api/vencimentos'); const d = await r.json(); setItems(d); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const proceedWithFile = async (file: File) => {
    setSelectedFile(file);
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setOcrLoading(true); setOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'vencimento');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        if (d?.success && d?.data) {
          const ocrData = d.data;
          const updates: any = {};
          if (ocrData.funcionario) updates.funcionario = ocrData.funcionario;
          if (ocrData.valorBruto) updates.valorBruto = String(ocrData.valorBruto);
          if (ocrData.valorLiquido) updates.valorLiquido = String(ocrData.valorLiquido);
          if (ocrData.segSocial) updates.segSocial = String(ocrData.segSocial);
          if (ocrData.irs) updates.irs = String(ocrData.irs);
          if (ocrData.periodo) updates.periodo = ocrData.periodo;
          if (ocrData.dataPagamento) updates.dataPagamento = ocrData.dataPagamento;
          if (ocrData.cargo) updates.notas = (updates.notas ? updates.notas + ' | ' : '') + 'Cargo: ' + ocrData.cargo;
          if (ocrData.nif) updates.notas = (updates.notas ? updates.notas + ' | ' : '') + 'NIF: ' + ocrData.nif;
          if (ocrData.empresa) updates.notas = (updates.notas ? updates.notas + ' | ' : '') + 'Empresa: ' + ocrData.empresa;
          setForm(prev => ({ ...prev, ...updates }));
          setOcrDone(true); toast.success('Dados do recibo extraídos');
        }
      } catch {} finally { setOcrLoading(false); }
    }
  };

  const proceedWithComprovante = async (file: File) => {
    setComprovanteFile(file);
    // Anexar o comprovativo de pagamento marca automaticamente o vencimento como "pago"
    // (independentemente de o OCR ter sucesso ou não). Se ainda não houver data de
    // pagamento, assume a data de hoje.
    setForm(prev => ({ ...prev, estado: 'pago', dataPagamento: prev.dataPagamento || new Date().toISOString().split('T')[0] }));
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setComprovanteOcrLoading(true); setComprovanteOcrDone(false);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('tipo', 'comprovativo');
        const r = await fetch('/api/ocr', { method: 'POST', body: fd }); const d = await r.json();
        if (d?.success && d?.data) {
          const ocrData = d.data;
          const updates: any = { estado: 'pago' };
          if (ocrData.valor && !form.valorLiquido) updates.valorLiquido = String(ocrData.valor);
          if (ocrData.data && !form.dataPagamento) updates.dataPagamento = ocrData.data;
          if (ocrData.entidade && !form.funcionario) updates.funcionario = ocrData.entidade;
          setForm(prev => ({ ...prev, ...updates }));
          setComprovanteOcrDone(true); toast.success('Dados do comprovativo extraídos');
        }
      } catch {} finally { setComprovanteOcrLoading(false); }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); proceedWithFile(c); } });
    } else { proceedWithFile(file); }
  };

  const handleComprovanteSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); proceedWithComprovante(c); } });
    } else { proceedWithComprovante(file); }
  };

  const handleSave = async () => {
    if (!form.funcionario || !form.valorBruto) { toast.error('Preencha funcionário e valor bruto'); return; }
    setUploading(true);
    try {
      let cloudStoragePath = editing?.cloudStoragePath || null;
      let contentType = editing?.contentType || null;
      let nomeOriginal = editing?.nomeOriginal || null;
      let comprovanteStoragePath = editing?.comprovanteStoragePath || null;
      let comprovanteContentType = editing?.comprovanteContentType || null;
      let comprovanteNomeOriginal = editing?.comprovanteNomeOriginal || null;

      if (selectedFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'attachment' }, body: selectedFile });
        cloudStoragePath = pres.cloud_storage_path;
        contentType = selectedFile.type;
        nomeOriginal = selectedFile.name;
      }

      if (comprovanteFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: comprovanteFile.name, contentType: comprovanteFile.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': comprovanteFile.type, 'Content-Disposition': 'attachment' }, body: comprovanteFile });
        comprovanteStoragePath = pres.cloud_storage_path;
        comprovanteContentType = comprovanteFile.type;
        comprovanteNomeOriginal = comprovanteFile.name;
      }

      const body = { ...form, valorBruto: parseFloat(form.valorBruto) || 0, valorLiquido: parseFloat(form.valorLiquido) || 0, segSocial: parseFloat(form.segSocial) || 0, irs: parseFloat(form.irs) || 0, dataPagamento: form.dataPagamento || null, cloudStoragePath, contentType, nomeOriginal, comprovanteStoragePath, comprovanteContentType, comprovanteNomeOriginal };
      const url = editing ? `/api/vencimentos/${editing.id}` : '/api/vencimentos';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(editing ? 'Vencimento atualizado' : 'Vencimento registado');
      setShowModal(false); setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setComprovanteFile(null); setOcrDone(false); setComprovanteOcrDone(false); load();
    } catch { toast.error('Erro ao guardar'); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Eliminar este vencimento?')) return; await fetch(`/api/vencimentos/${id}`, { method: 'DELETE' }); toast.success('Eliminado'); load(); };
  const openEdit = (item: any) => { setEditing(item); setForm({ funcionario: item.funcionario || '', valorBruto: String(item.valorBruto || ''), valorLiquido: String(item.valorLiquido || ''), segSocial: String(item.segSocial || ''), irs: String(item.irs || ''), periodo: item.periodo || '', estado: item.estado || 'pendente', notas: item.notas || '', dataPagamento: item.dataPagamento ? new Date(item.dataPagamento).toISOString().split('T')[0] : '' }); setSelectedFile(null); setComprovanteFile(null); setOcrDone(false); setComprovanteOcrDone(false); setShowModal(true); };
  const openNew = () => { setEditing(null); setForm({...EMPTY_FORM}); setSelectedFile(null); setComprovanteFile(null); setOcrDone(false); setComprovanteOcrDone(false); setShowModal(true); };

  const openPreview = async (id: string, type: 'recibo' | 'comprovante') => {
    try {
      const r = await fetch(`/api/vencimentos/${id}`); const d = await r.json();
      const url = type === 'comprovante' ? d.comprovanteUrl : d.url;
      const ct = type === 'comprovante' ? (d.comprovanteContentType || 'image/jpeg') : (d.contentType || 'application/pdf');
      if (url) { setPreviewUrl(url); setPreviewType(ct); }
      else toast.error('Sem documento');
    } catch { toast.error('Erro'); }
  };

  const filtered = items.filter(i => !search || i.funcionario?.toLowerCase().includes(search.toLowerCase()) || i.periodo?.toLowerCase().includes(search.toLowerCase()) || String(i.valorBruto).includes(search) || String(i.valorLiquido).includes(search));
  const ts = (x: any) => x ? new Date(x).getTime() : 0;
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'data_asc') return (ts(a.dataPagamento) || ts(a.createdAt)) - (ts(b.dataPagamento) || ts(b.createdAt));
    if (sortBy === 'entidade') return (a.funcionario || '').localeCompare(b.funcionario || '', 'pt', { sensitivity: 'base' });
    return (ts(b.dataPagamento) || ts(b.createdAt)) - (ts(a.dataPagamento) || ts(a.createdAt));
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Vencimentos" description="Gestão de salários e vencimentos" icon={Users} action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Novo Vencimento</button>} />
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="input pl-10 w-full" /></div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input sm:w-56"><option value="data_desc">Data (mais recente)</option><option value="data_asc">Data (mais antiga)</option><option value="entidade">Funcionário (A-Z)</option></select>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <EmptyState icon={Users} title="Sem vencimentos" description="Registe o primeiro vencimento" /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Funcionário</th><th className="text-left p-3 hidden sm:table-cell">Período</th><th className="text-right p-3"><span className="md:hidden">Líquido</span><span className="hidden md:inline">Bruto</span></th><th className="text-right p-3 hidden md:table-cell">Líquido</th><th className="text-right p-3 hidden lg:table-cell">Seg. Social</th><th className="text-right p-3 hidden lg:table-cell">IRS</th><th className="text-center p-3">Estado</th><th className="text-center p-3">Ações</th></tr></thead><tbody>
          {sorted.map(item => (<tr key={item.id} className="border-b hover:bg-muted/30 transition-colors"><td className="p-3 font-medium">{item.funcionario}{item.criadoPor && <span className="block text-[11px] font-normal text-muted-foreground/70">por {item.criadoPor}</span>}</td><td className="p-3 hidden sm:table-cell">{item.periodo}</td><td className="p-3 text-right font-mono"><span className="md:hidden">{formatCurrency(item.valorLiquido || item.valorBruto)}</span><span className="hidden md:inline">{formatCurrency(item.valorBruto)}</span></td><td className="p-3 text-right font-mono hidden md:table-cell">{formatCurrency(item.valorLiquido)}</td><td className="p-3 text-right font-mono hidden lg:table-cell">{formatCurrency(item.segSocial)}</td><td className="p-3 text-right font-mono hidden lg:table-cell">{formatCurrency(item.irs)}</td><td className="p-3 text-center"><EstadoBadge estado={item.estado} /></td><td className="p-3 text-center whitespace-nowrap"><div className="flex justify-center gap-1 flex-nowrap">{item.cloudStoragePath && <button onClick={() => openPreview(item.id, 'recibo')} className="p-1.5 rounded-lg hover:bg-muted flex-shrink-0" title="Ver Recibo"><Eye className="h-4 w-4" /></button>}{item.comprovanteStoragePath && <button onClick={() => openPreview(item.id, 'comprovante')} className="p-1.5 rounded-lg hover:bg-muted text-green-600 flex-shrink-0" title="Ver Comprovativo"><Receipt className="h-4 w-4" /></button>}<button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted flex-shrink-0"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-muted text-red-500 flex-shrink-0"><Trash2 className="h-4 w-4" /></button></div></td></tr>))}
        </tbody></table></div></div>
      )}

      {/* Modal Criar/Editar */}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{editing ? 'Editar' : 'Novo'} Vencimento</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          {/* Recibo de Vencimento */}
          <div><label className="label">Recibo de Vencimento</label><div className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>{ocrLoading ? <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" />A ler recibo...</div> : ocrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Dados extraídos • {selectedFile?.name}</div> : selectedFile ? <span className="text-sm">{selectedFile.name}</span> : editing?.cloudStoragePath ? <span className="text-sm text-green-600">✓ Recibo já anexado (clique para substituir)</span> : <div className="flex flex-col items-center gap-1"><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Tirar foto ou carregar recibo</span></div>}</div><input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} /></div>

          {/* Comprovativo de Pagamento */}
          <div><label className="label">Comprovativo de Pagamento</label><div className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-3 text-center cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => comprovanteRef.current?.click()}>{comprovanteOcrLoading ? <div className="flex items-center justify-center gap-2 text-green-600"><Loader2 className="h-5 w-5 animate-spin" />A ler comprovativo...</div> : comprovanteOcrDone ? <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Dados extraídos • {comprovanteFile?.name}</div> : comprovanteFile ? <span className="text-sm">{comprovanteFile.name}</span> : editing?.comprovanteStoragePath ? <span className="text-sm text-green-600">✓ Comprovativo já anexado (clique para substituir)</span> : <div className="flex flex-col items-center gap-1"><Receipt className="h-6 w-6 text-green-500/60" /><span className="text-sm text-muted-foreground">Tirar foto do comprovativo de pagamento</span></div>}</div><input ref={comprovanteRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleComprovanteSelect} /></div>

          <div><label className="label">Funcionário *</label><input value={form.funcionario} onChange={e => setForm({...form, funcionario: e.target.value})} className="input w-full" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Valor Bruto *</label><input type="number" step="0.01" value={form.valorBruto} onChange={e => setForm({...form, valorBruto: e.target.value})} className="input w-full" /></div><div><label className="label">Valor Líquido</label><input type="number" step="0.01" value={form.valorLiquido} onChange={e => setForm({...form, valorLiquido: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Seg. Social</label><input type="number" step="0.01" value={form.segSocial} onChange={e => setForm({...form, segSocial: e.target.value})} className="input w-full" /></div><div><label className="label">IRS</label><input type="number" step="0.01" value={form.irs} onChange={e => setForm({...form, irs: e.target.value})} className="input w-full" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">Período</label><input value={form.periodo} onChange={e => setForm({...form, periodo: e.target.value})} placeholder="Jun 2026" className="input w-full" /></div><div><label className="label">Data Pagamento</label><input type="date" value={form.dataPagamento} onChange={e => setForm({...form, dataPagamento: e.target.value})} className="input w-full" /></div></div>
          <div><label className="label">Estado</label><select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} className="input w-full"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
          <div><label className="label">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input w-full" rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={uploading} className="btn-primary flex items-center gap-2">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar' : 'Registar'}</button></div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Preview Modal com Download e Imprimir */}
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setPreviewUrl(null); setPreviewType(''); }}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold">Documento</h3>
          <div className="flex items-center gap-2">
            <a href={previewUrl} download className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" />Descarregar</a>
            <button onClick={() => { const w = window.open(previewUrl, '_blank'); if (w) { w.onload = () => w.print(); } }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-muted hover:bg-muted/80"><Printer className="h-4 w-4" />Imprimir</button>
            <button onClick={() => { setPreviewUrl(null); setPreviewType(''); }} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {previewType?.startsWith?.('image/') ? (
            <img src={previewUrl} alt="Documento" className="max-w-full h-auto rounded-lg mx-auto" />
          ) : (
            <FilePreviewFrame url={previewUrl} />
          )}
        </div>
      </motion.div></motion.div>}</AnimatePresence>

      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}
    </div>
  );
}
