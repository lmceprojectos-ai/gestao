'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderLock, Plus, Trash2, X, Upload, Loader2, Pencil, Download, FileText, Lock, ShieldCheck, CheckCircle2, Circle, UserCircle, AlertCircle, FileStack, Sparkles, AlertTriangle } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i);
const EMPTY_FORM = { ano: String(currentYear), descricao: '', categoria: '', entidadeNome: '', valor: '', dataDocumento: '' };

const CAT_LABEL: Record<string, string> = {
  recibos: 'Recibos de vencimento',
  declaracao_rendimentos: 'Declaração de rendimentos e retenções',
  comprovativo_irs: 'Comprovativo de IRS retido',
  comprovativo_ss: 'Comprovativo de Segurança Social',
  irs_jovem: 'IRS Jovem',
  maiores_65: 'Benefício maiores de 65',
  saude: 'Despesas de saúde',
  educacao: 'Despesas de educação',
  habitacao: 'Habitação / rendas',
  dependentes: 'Dependentes',
  outro: 'Outro documento',
};

// Categorias que aceitam vários documentos (ex.: várias faturas de saúde/educação/rendas)
const MULTI_CATS = new Set(['saude', 'educacao', 'habitacao', 'dependentes', 'recibos', 'outro']);

function calcIdade(dataNascimento: any, ano: number): number | null {
  if (!dataNascimento) return null;
  try { const d = new Date(dataNascimento); return ano - d.getUTCFullYear(); } catch { return null; }
}

function buildChecklist(ano: number, idade: number | null, vencimentos: any[]) {
  const vencAno = (vencimentos || []).filter(v => (v.periodo || '').startsWith(String(ano)));
  const temIrs = vencAno.some(v => (v.irs || 0) > 0);
  const temSS = vencAno.some(v => (v.segSocial || 0) > 0);
  const items: { key: string; label: string; desc: string; obrigatorio: boolean }[] = [];
  items.push({ key: 'recibos', label: 'Recibos de vencimento do ano', desc: `${vencAno.length} recibo(s) registado(s) nos Vencimentos`, obrigatorio: true });
  items.push({ key: 'declaracao_rendimentos', label: 'Declaração de rendimentos e retenções (entidade patronal)', desc: 'Documento anual entregue pela entidade patronal', obrigatorio: true });
  if (temIrs) items.push({ key: 'comprovativo_irs', label: 'Comprovativo de IRS retido na fonte', desc: 'Foi retido IRS nos seus vencimentos deste ano', obrigatorio: true });
  if (temSS) items.push({ key: 'comprovativo_ss', label: 'Comprovativo de descontos para a Segurança Social', desc: 'Existem descontos de Segurança Social nos vencimentos', obrigatorio: true });
  if (idade !== null && idade <= 35) items.push({ key: 'irs_jovem', label: 'IRS Jovem (até 35 anos)', desc: `Tem ${idade} anos — pode beneficiar do regime IRS Jovem`, obrigatorio: false });
  if (idade !== null && idade >= 65) items.push({ key: 'maiores_65', label: 'Benefícios para maiores de 65 anos', desc: `Tem ${idade} anos — podem aplicar-se benefícios específicos`, obrigatorio: false });
  items.push({ key: 'saude', label: 'Despesas de saúde', desc: 'Faturas com NIF (médico, farmácia, etc.) — pode adicionar várias', obrigatorio: false });
  items.push({ key: 'educacao', label: 'Despesas de educação', desc: 'Propinas, material escolar, explicações — pode adicionar várias', obrigatorio: false });
  items.push({ key: 'habitacao', label: 'Habitação / rendas', desc: 'Rendas ou juros de crédito à habitação — pode adicionar várias', obrigatorio: false });
  items.push({ key: 'dependentes', label: 'Documentos de dependentes', desc: 'Comprovativos relativos a dependentes (se aplicável) — pode adicionar vários', obrigatorio: false });
  return items;
}

export default function DocumentosIrsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [perfil, setPerfil] = useState<any>(null);
  const [vencimentos, setVencimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(currentYear);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Upload múltiplo com deteção automática
  const multiFileRef = useRef<HTMLInputElement>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchItems, setBatchItems] = useState<{ name: string; status: string; categoria?: string; entidadeNome?: string | null; valor?: number | null; dataDocumento?: string | null; error?: string }[]>([]);

  const load = async () => {
    try {
      const [rd, rp] = await Promise.all([fetch('/api/documentos-irs'), fetch('/api/perfil')]);
      const d = await rd.json();
      const p = await rp.json();
      setItems(Array.isArray(d) ? d : []);
      setPerfil(p?.perfil || null);
      setVencimentos(p?.vencimentos || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Lê a resposta de forma segura: se não for JSON válido (ex.: página de erro HTML),
  // devolve um objeto com mensagem compreensível em vez de rebentar com erro de "doctype".
  const lerRespostaJson = async (r: Response): Promise<any> => {
    const texto = await r.text();
    try { return JSON.parse(texto); } catch {
      return { error: r.ok ? 'Resposta inesperada do servidor.' : 'O serviço está temporariamente indisponível. Pode preencher os dados manualmente.' };
    }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ''); resolve(r.includes(',') ? r.split(',')[1] : r); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const analyzeFile = async (file: File) => {
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const r = await fetch('/api/documentos-irs/classificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: base64, contentType: file.type, fileName: file.name }) });
      const data = await lerRespostaJson(r);
      if (!r.ok) throw new Error(data?.error || 'Não foi possível analisar o documento automaticamente. Pode preencher os dados manualmente.');
      setForm(prev => ({
        ...prev,
        categoria: prev.categoria || data.categoria || '',
        descricao: prev.descricao || data.descricao || '',
        entidadeNome: data.entidadeNome || '',
        valor: data.valor !== null && data.valor !== undefined ? String(data.valor) : '',
        dataDocumento: data.dataDocumento || '',
      }));
      toast.success('Nome, data e valor identificados');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível analisar automaticamente. Pode preencher os dados manualmente.');
    } finally { setAnalyzing(false); }
  };

  const proceedWithFile = async (file: File) => { setSelectedFile(file); await analyzeFile(file); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); void proceedWithFile(c); } });
    } else { await proceedWithFile(file); }
  };

  const handleSave = async () => {
    if (!form.ano) { toast.error('Indique o ano fiscal'); return; }
    if (!editing && !selectedFile) { toast.error('Anexe um documento'); return; }
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
      const body = { ano: form.ano, descricao: form.descricao, categoria: form.categoria || null, entidadeNome: form.entidadeNome, valor: form.valor, dataDocumento: form.dataDocumento, cloudStoragePath, contentType, nomeOriginal };
      const url = editing ? `/api/documentos-irs/${editing.id}` : '/api/documentos-irs';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(editing ? 'Documento atualizado' : 'Documento guardado');
      setShowModal(false); setEditing(null); setForm({ ...EMPTY_FORM }); setSelectedFile(null); load();
    } catch { toast.error('Erro ao guardar'); } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Eliminar este documento?')) return; await fetch(`/api/documentos-irs/${id}`, { method: 'DELETE' }); toast.success('Eliminado'); load(); };

  const handleMultiSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setShowBatch(true);
    setBatchRunning(true);
    setBatchItems(files.map(f => ({ name: f.name, status: 'pendente' })));
    const updateItem = (i: number, patch: any) => setBatchItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));

    for (let i = 0; i < files.length; i++) {
      try {
        let file = files[i];
        if (file.type.startsWith('image/')) { try { file = await compressImage(file); } catch {} }
        // 1) Classificar
        updateItem(i, { status: 'a analisar' });
        const base64 = await fileToBase64(file);
        const cr = await fetch('/api/documentos-irs/classificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64: base64, contentType: file.type, fileName: file.name }) });
        const cd = await lerRespostaJson(cr);
        if (!cr.ok) throw new Error(cd?.error || 'Não foi possível analisar o documento');
        const categoria = cd.categoria || 'outro';
        const descricao = cd.descricao || '';
        const entidadeNome = cd.entidadeNome || null;
        const valor = cd.valor ?? null;
        const dataDocumento = cd.dataDocumento || null;
        // 2) Upload
        updateItem(i, { status: 'a carregar', categoria, entidadeNome, valor, dataDocumento });
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        // 3) Guardar
        const r = await fetch('/api/documentos-irs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ano: String(ano), descricao, categoria, entidadeNome, valor, dataDocumento, cloudStoragePath: pres.cloud_storage_path, contentType: file.type, nomeOriginal: file.name }) });
        if (!r.ok) throw new Error('Erro ao guardar o documento');
        updateItem(i, { status: 'concluido', categoria, entidadeNome, valor, dataDocumento });
      } catch (error: any) {
        updateItem(i, { status: 'erro', error: error?.message || 'Falhou' });
      }
    }
    setBatchRunning(false);
    load();
    toast.success('Documentos processados');
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ ano: String(item.ano || currentYear), descricao: item.descricao || '', categoria: item.categoria || '', entidadeNome: item.entidadeNome || '', valor: item.valor !== null && item.valor !== undefined ? String(item.valor) : '', dataDocumento: item.dataDocumento ? String(item.dataDocumento).slice(0, 10) : '' });
    setSelectedFile(null); setShowModal(true);
  };
  const openNew = (categoria?: string, anoAlvo?: number) => { setEditing(null); setForm({ ...EMPTY_FORM, ano: String(anoAlvo || ano), categoria: categoria || '' }); setSelectedFile(null); setShowModal(true); };

  const openPreview = async (id: string) => {
    try {
      const r = await fetch(`/api/documentos-irs/${id}`); const d = await r.json();
      if (d?.url) setPreviewUrl(d.url); else toast.error('Sem documento');
    } catch { toast.error('Erro'); }
  };

  const idade = calcIdade(perfil?.dataNascimento, ano);
  const checklist = perfil?.funcionarioVencimento ? buildChecklist(ano, idade, vencimentos) : [];
  const docsAno = items.filter(i => i.ano === ano);
  const catCount = (key: string) => docsAno.filter(i => i.categoria === key).length;
  const catTotal = (key: string) => docsAno
    .filter(i => i.categoria === key && typeof i.valor === 'number')
    .reduce((sum, i) => sum + i.valor, 0);
  const totalAno = docsAno
    .filter(i => typeof i.valor === 'number')
    .reduce((sum, i) => sum + i.valor, 0);
  const totalCards = [
    { key: 'saude', label: 'Saúde', color: 'text-rose-600', bg: 'bg-rose-50' },
    { key: 'educacao', label: 'Educação', color: 'text-sky-600', bg: 'bg-sky-50' },
    { key: 'habitacao', label: 'Rendas / Habitação', color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Documentos IRS" description="O seu espaço privado para documentos do IRS" icon={FolderLock} action={<div className="flex gap-2"><button onClick={() => multiFileRef.current?.click()} className="btn-secondary flex items-center gap-2"><FileStack className="h-4 w-4" /><span className="hidden sm:inline">Carregar vários</span><Sparkles className="h-3.5 w-3.5 text-amber-500" /></button><button onClick={() => openNew()} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Novo</button></div>} />

      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <p><span className="font-semibold">Espaço 100% privado.</span> Apenas você vê estes documentos. Nem os administradores nem outros utilizadores têm acesso aos seus documentos do IRS.</p>
      </div>

      {/* Perfil / ano */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 rounded-lg border bg-card p-4 flex items-center gap-3">
          <UserCircle className="h-9 w-9 text-primary flex-shrink-0" />
          {perfil?.funcionarioVencimento ? (
            <div className="text-sm">
              <p className="font-medium">{perfil.nomeCompleto || perfil.funcionarioVencimento}</p>
              <p className="text-muted-foreground">{idade !== null ? `${idade} anos` : 'Data de nascimento por preencher'} • <Link href="/perfil" className="text-primary hover:underline">editar perfil</Link></p>
            </div>
          ) : (
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><AlertCircle className="h-4 w-4 text-amber-500" />Complete o seu perfil</p>
              <p className="text-muted-foreground">Preencha os seus dados e associe o seu funcionário em <Link href="/perfil" className="text-primary hover:underline">O Meu Perfil</Link> para ver a checklist do IRS.</p>
            </div>
          )}
        </div>
        <div>
          <label className="label">Ano fiscal</label>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value, 10))} className="input sm:w-40">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Totais dos valores identificados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {totalCards.map(card => (
          <div key={card.key} className={`rounded-xl p-4 ${card.bg}`}>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{formatCurrency(catTotal(card.key))}</p>
            <p className="text-xs text-muted-foreground mt-1">{catCount(card.key)} documento(s)</p>
          </div>
        ))}
        <div className="rounded-xl p-4 bg-emerald-50">
          <p className="text-xs text-muted-foreground">Total identificado em {ano}</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">{formatCurrency(totalAno)}</p>
          <p className="text-xs text-muted-foreground mt-1">Soma dos documentos com valor</p>
        </div>
      </div>

      {/* Checklist */}
      {perfil?.funcionarioVencimento && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-muted/40">
            <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Documentos necessários para o IRS {ano}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Lista sugerida com base nos seus vencimentos e idade. É um apoio/lembrete, não substitui aconselhamento fiscal.</p>
          </div>
          <div className="divide-y">
            {checklist.map(c => {
              const count = catCount(c.key);
              const done = count > 0;
              const multi = MULTI_CATS.has(c.key);
              return (
                <div key={c.key} className="flex items-center gap-3 p-3">
                  {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">{c.label}{c.obrigatorio && <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Necessário</span>}{multi && <span className="text-[10px] uppercase tracking-wide text-sky-600 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">Vários</span>}</p>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {done && <span className="text-xs text-emerald-600 font-medium">{multi ? `${count} carregado(s) · ${formatCurrency(catTotal(c.key))}` : 'Entregue'}</span>}
                    {(!done || multi) && <button onClick={() => openNew(c.key, ano)} className="btn-secondary text-xs flex items-center gap-1"><Upload className="h-3.5 w-3.5" />{done ? 'Adicionar mais' : 'Adicionar'}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de documentos do ano */}
      <div>
        <h3 className="font-semibold mb-2">Documentos carregados ({ano})</h3>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : docsAno.length === 0 ? <EmptyState icon={FolderLock} title="Sem documentos" description={`Ainda não carregou documentos para ${ano}`} /> : (
          <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-3">Categoria</th><th className="text-left p-3">Fatura / Entidade</th><th className="text-left p-3">Data</th><th className="text-right p-3">Valor</th><th className="text-center p-3">Documento</th><th className="text-center p-3">Ações</th></tr></thead><tbody>
            {docsAno.map(item => (<tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="p-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{CAT_LABEL[item.categoria] || 'Outro'}</span></td>
              <td className="p-3 min-w-48"><p className="font-medium">{item.entidadeNome || item.nomeOriginal || 'Entidade não identificada'}</p>{item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}</td>
              <td className="p-3 whitespace-nowrap">{item.dataDocumento ? formatDate(item.dataDocumento) : '-'}</td>
              <td className="p-3 text-right whitespace-nowrap font-semibold">{typeof item.valor === 'number' ? formatCurrency(item.valor) : '-'}</td>
              <td className="p-3 text-center">{item.cloudStoragePath ? <button onClick={() => openPreview(item.id)} className="p-1 rounded hover:bg-muted" title="Ver documento"><FileText className="h-4 w-4 text-emerald-600 mx-auto" /></button> : <span className="text-muted-foreground">-</span>}</td>
              <td className="p-3 text-center"><div className="flex justify-center gap-1"><button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted" title="Corrigir dados"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-muted text-red-500" title="Eliminar"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>))}
          </tbody></table></div></div>
        )}
      </div>

      {/* Modal Criar/Editar */}
      <AnimatePresence>{showModal && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><Lock className="h-5 w-5 text-emerald-600" />{editing ? 'Editar' : 'Novo'} Documento IRS</h3><button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Ano Fiscal *</label><input type="number" min="2000" max={currentYear + 1} value={form.ano} onChange={e => setForm({...form, ano: e.target.value})} className="input w-full" /></div>
            <div><label className="label">Categoria</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} className="input w-full"><option value="">— Sem categoria —</option>{Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div><label className="label">Descrição</label><input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Fatura de farmácia" className="input w-full" /></div>
          <div><label className="label">Nome / Entidade da fatura</label><input value={form.entidadeNome} onChange={e => setForm({...form, entidadeNome: e.target.value})} placeholder="Ex: Farmácia Central" className="input w-full" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Data da fatura</label><input type="date" value={form.dataDocumento} onChange={e => setForm({...form, dataDocumento: e.target.value})} className="input w-full" /></div>
            <div><label className="label">Valor (€)</label><input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} placeholder="0,00" className="input w-full" /></div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <label className="label flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-600" />Documento (PDF ou imagem)</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
              {selectedFile ? <div className="flex items-center justify-center gap-2 text-sm">{analyzing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}<span>{analyzing ? 'A identificar nome, data e valor...' : selectedFile.name}</span></div>
              : editing?.cloudStoragePath ? <span className="text-sm text-muted-foreground">Documento já anexado • Clique para substituir</span>
              : <div className="flex flex-col items-center gap-1"><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregar ou digitalizar documento</span></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button onClick={handleSave} disabled={uploading || analyzing} className="btn-primary flex items-center gap-2">{(uploading || analyzing) && <Loader2 className="h-4 w-4 animate-spin" />}{analyzing ? 'A analisar...' : 'Guardar'}</button></div>
      </motion.div></motion.div>}</AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Documento IRS</h3><div className="flex gap-2"><a href={previewUrl} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Download</a><button onClick={() => setPreviewUrl(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl} /></div>
      </motion.div></motion.div>}</AnimatePresence>
      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}

      {/* Input de upload múltiplo */}
      <input ref={multiFileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleMultiSelect} />

      {/* Modal de progresso do upload múltiplo */}
      <AnimatePresence>{showBatch && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!batchRunning) setShowBatch(false); }}><motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1"><h3 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />Deteção automática</h3>{!batchRunning && <button onClick={() => setShowBatch(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>}</div>
        <p className="text-xs text-muted-foreground mb-4">Cada ficheiro é analisado e arrumado na categoria certa (ano {ano}). Pode carregar várias despesas de saúde de uma vez, por exemplo.</p>
        <div className="space-y-2">
          {batchItems.map((it, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
              <div className="flex-shrink-0">
                {it.status === 'concluido' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : it.status === 'erro' ? <AlertTriangle className="h-5 w-5 text-red-500" />
                  : (it.status === 'a analisar' || it.status === 'a carregar') ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  : <Circle className="h-5 w-5 text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{it.name}</p>
                <p className="text-xs text-muted-foreground">{it.status === 'concluido' && it.categoria ? `${it.entidadeNome || 'Entidade não identificada'} · ${it.dataDocumento ? formatDate(it.dataDocumento) : 'sem data'} · ${typeof it.valor === 'number' ? formatCurrency(it.valor) : 'sem valor'} · ${CAT_LABEL[it.categoria] || 'Outro'}` : it.status === 'a analisar' ? 'A identificar categoria, nome, data e valor...' : it.status === 'a carregar' ? 'A guardar...' : it.status === 'erro' ? (it.error || 'Falhou') : 'Em espera'}</p>
              </div>
            </div>
          ))}
        </div>
        {!batchRunning && <div className="flex justify-end mt-4"><button onClick={() => setShowBatch(false)} className="btn-primary">Concluir</button></div>}
      </motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
