'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle, Plus, Edit2, Trash2, X, Camera, Loader2, CheckCircle2, FileText, Receipt, Search, Eye, Download } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate, formatDateInput } from '@/lib/format';
import { EstadoBadge } from '@/components/estado-badge';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { ImageCropModal } from '@/components/image-crop-modal';
import { useConfig } from '@/hooks/use-config';

export default function PagamentosPage() {
  const { items: formasPagamento } = useConfig('forma_pagamento');
  const { items: estados } = useConfig('estado');
  const [items, setItems] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ descricao: '', valor: '', dataPagamento: '', estado: 'pendente', metodoPagamento: '', referencia: '', notas: '', fornecedorId: '', contaBancariaId: '', faturaId: '', reconciliado: false, reciboPath: '', reciboContentType: '', reciboOriginal: '', comprovativoPath: '', comprovativoContentType: '', comprovativoOriginal: '' });
  const [modalFaturas, setModalFaturas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('data');
  const [docPreview, setDocPreview] = useState<{ url: string; contentType: string; title: string } | null>(null);

  // Document photo states (recibo do fornecedor + comprovativo)
  const [reciboPreview, setReciboPreview] = useState<string | null>(null);
  const [comprovativoDocPreview, setComprovativoDocPreview] = useState<string | null>(null);
  const [uploadingRecibo, setUploadingRecibo] = useState(false);
  const [uploadingComprovativo, setUploadingComprovativo] = useState(false);
  const reciboRef = useRef<HTMLInputElement>(null);
  const comprovativoDocRef = useRef<HTMLInputElement>(null);

  // Proof states
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofScanning, setProofScanning] = useState(false);
  const [proofData, setProofData] = useState<any>(null);
  const [pendingFaturas, setPendingFaturas] = useState<any[]>([]);
  const [selectedFaturas, setSelectedFaturas] = useState<Record<string, boolean>>({});
  const [faturaSearch, setFaturaSearch] = useState('');
  const [showAllFaturas, setShowAllFaturas] = useState(false);
  const [proofSaving, setProofSaving] = useState(false);
  const [proofStep, setProofStep] = useState<'upload' | 'review' | 'select'>('upload');
  const proofFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [p, f, co] = await Promise.all([fetch('/api/pagamentos').then((x) => x.json()), fetch('/api/fornecedores').then((x) => x.json()), fetch('/api/contas').then((x) => x.json())]);
      setItems(p ?? []); setFornecedores(f ?? []); setContas(co ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Valores por omissão para novos pagamentos: método = transferência, conta = a conta base/principal ativa.
  const metodoDefault = () => {
    const t = (formasPagamento ?? []).find((f: any) => /transfer/i.test(f?.valor || '') || /transfer/i.test(f?.label || ''));
    return t?.valor || (formasPagamento ?? [])[0]?.valor || '';
  };
  const contaDefault = () => {
    const ativas = (contas ?? []).filter((c: any) => c?.ativa);
    const base = ativas.find((c: any) => /base|principal/i.test(c?.nome || ''));
    return base?.id || ativas[0]?.id || '';
  };

  // Resolve o método guardado para uma opção válida (tolera acentos/maiúsculas de registos antigos);
  // se estiver vazio ou não corresponder a nenhuma opção, usa o método por omissão.
  const normStr = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const resolveMetodo = (stored?: string) => {
    const s = (stored || '').trim();
    const opts = formasPagamento ?? [];
    if (!s) return metodoDefault();
    if (opts.some((f: any) => f?.valor === s)) return s;
    const ns = normStr(s);
    const m = opts.find((f: any) => normStr(f?.valor) === ns || normStr(f?.label) === ns);
    return m?.valor || metodoDefault();
  };

  // Carrega as faturas pendentes de um fornecedor para o seletor "Fatura a conciliar".
  const loadModalFaturas = async (fornecedorId: string, ensure?: any) => {
    if (!fornecedorId) { setModalFaturas(ensure?.id ? [ensure] : []); return; }
    try {
      const r = await fetch(`/api/faturas/pendentes?fornecedorId=${fornecedorId}`);
      const d = await r.json();
      let list = Array.isArray(d) ? d : [];
      if (ensure?.id && !list.some((x: any) => x.id === ensure.id)) list = [ensure, ...list];
      setModalFaturas(list);
    } catch { setModalFaturas(ensure?.id ? [ensure] : []); }
  };

  const openNew = () => { setEditing(null); setReciboPreview(null); setComprovativoDocPreview(null); setModalFaturas([]); setForm({ descricao: '', valor: '', dataPagamento: formatDateInput(new Date().toISOString()), estado: 'pendente', metodoPagamento: metodoDefault(), referencia: '', notas: '', fornecedorId: '', contaBancariaId: contaDefault(), faturaId: '', reconciliado: false, reciboPath: '', reciboContentType: '', reciboOriginal: '', comprovativoPath: '', comprovativoContentType: '', comprovativoOriginal: '' }); setShowModal(true); };
  const openEdit = (p: any) => { setEditing(p); setReciboPreview(null); setComprovativoDocPreview(null); setForm({ descricao: p?.descricao ?? '', valor: String(p?.valor ?? ''), dataPagamento: formatDateInput(p?.dataPagamento), estado: p?.estado ?? 'pendente', metodoPagamento: resolveMetodo(p?.metodoPagamento), referencia: p?.referencia ?? '', notas: p?.notas ?? '', fornecedorId: p?.fornecedorId ?? '', contaBancariaId: p?.contaBancariaId || contaDefault(), faturaId: p?.faturaId ?? '', reconciliado: !!p?.reconciliado, reciboPath: p?.reciboPath ?? '', reciboContentType: p?.reciboContentType ?? '', reciboOriginal: p?.reciboOriginal ?? '', comprovativoPath: p?.comprovativoPath ?? '', comprovativoContentType: p?.comprovativoContentType ?? '', comprovativoOriginal: p?.comprovativoOriginal ?? '' }); loadModalFaturas(p?.fornecedorId ?? '', p?.fatura?.id ? { id: p.fatura.id, numero: p.fatura.numero, valor: p?.valor, saldoPendente: p?.valor } : undefined); setShowModal(true); if (p?.reciboPath || p?.comprovativoPath) { fetch(`/api/pagamentos/${p.id}/url`).then((r) => r.json()).then((d) => { if (d?.reciboUrl) setReciboPreview(d.reciboUrl); if (d?.comprovativoUrl) setComprovativoDocPreview(d.comprovativoUrl); }).catch(() => {}); } };

  // Seleção de fornecedor no modal: recarrega faturas e limpa a fatura escolhida.
  const handlePickFornecedor = (fornecedorId: string) => {
    setForm((prev) => ({ ...prev, fornecedorId, faturaId: '' }));
    loadModalFaturas(fornecedorId);
  };

  // Seleção de fatura no modal: associa e preenche valor/descrição se ainda estiverem vazios.
  const handlePickFatura = (faturaId: string) => {
    const fat = modalFaturas.find((x: any) => x.id === faturaId);
    setForm((prev) => ({
      ...prev,
      faturaId,
      ...(fat ? {
        valor: prev.valor && Number(prev.valor) > 0 ? prev.valor : String(fat.saldoPendente ?? fat.valor ?? ''),
        descricao: prev.descricao?.trim() ? prev.descricao : `Pag. ${fat.numero || fat.entidadeNome || 'fatura'}`,
      } : {}),
    }));
  };

  const uploadDoc = async (file: File, kind: 'recibo' | 'comprovativo') => {
    const setUploading = kind === 'recibo' ? setUploadingRecibo : setUploadingComprovativo;
    const setPreview = kind === 'recibo' ? setReciboPreview : setComprovativoDocPreview;
    setUploading(true);
    try {
      const presignedRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: `${kind}_${file.name}`, contentType: file.type, isPublic: false }) });
      const { uploadUrl, cloud_storage_path } = await presignedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!uploadRes.ok) { toast.error('Erro no upload'); return; }
      setForm((prev) => ({ ...prev, ...(kind === 'recibo' ? { reciboPath: cloud_storage_path, reciboContentType: file.type, reciboOriginal: file.name } : { comprovativoPath: cloud_storage_path, comprovativoContentType: file.type, comprovativoOriginal: file.name }) }));
      setPreview(URL.createObjectURL(file));
      toast.success('Documento carregado');
    } catch { toast.error('Erro no upload'); } finally { setUploading(false); }
  };

  const handleDocFileRaw = (rawFile: File, kind: 'recibo' | 'comprovativo') => {
    if (rawFile.type.startsWith('image/')) {
      const src = URL.createObjectURL(rawFile);
      setCropImage({ src, callback: (blob: Blob) => { const cropped = new File([blob], rawFile.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); uploadDoc(cropped, kind); } });
    } else { uploadDoc(rawFile, kind); }
  };

  const removeDoc = (kind: 'recibo' | 'comprovativo') => {
    if (kind === 'recibo') { setReciboPreview(null); setForm((f) => ({ ...f, reciboPath: '', reciboContentType: '', reciboOriginal: '' })); }
    else { setComprovativoDocPreview(null); setForm((f) => ({ ...f, comprovativoPath: '', comprovativoContentType: '', comprovativoOriginal: '' })); }
  };

  const fetchDocUrl = async (p: any, kind: 'recibo' | 'comprovativo'): Promise<string | null> => {
    try {
      const r = await fetch(`/api/pagamentos/${p.id}/url`);
      const d = await r.json();
      return kind === 'recibo' ? (d?.reciboUrl || null) : (d?.comprovativoUrl || null);
    } catch { return null; }
  };

  const viewDoc = async (p: any, kind: 'recibo' | 'comprovativo') => {
    const url = await fetchDocUrl(p, kind);
    if (!url) { toast.error('Documento indisponível'); return; }
    const contentType = kind === 'recibo' ? (p.reciboContentType || 'image/jpeg') : (p.comprovativoContentType || 'image/jpeg');
    setDocPreview({ url, contentType, title: kind === 'recibo' ? 'Recibo do Fornecedor' : 'Comprovativo' });
  };

  const downloadDoc = async (p: any, kind: 'recibo' | 'comprovativo') => {
    const url = await fetchDocUrl(p, kind);
    if (!url) { toast.error('Documento indisponível'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = (kind === 'recibo' ? p.reciboOriginal : p.comprovativoOriginal) || `${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fornecedorId) { toast.error('Selecione o fornecedor'); return; }
    try {
      const url = editing ? `/api/pagamentos/${editing.id}` : '/api/pagamentos';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Erro'); return; }
      toast.success(editing ? 'Pagamento atualizado' : 'Pagamento criado');
      setShowModal(false); load();
    } catch { toast.error('Erro de rede'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza?')) return;
    await fetch(`/api/pagamentos/${id}`, { method: 'DELETE' });
    toast.success('Pagamento eliminado'); load();
  };

  // ---- Payment Proof flow ----
  const openProofModal = () => {
    setProofFile(null);
    setProofPreview(null);
    setProofData(null);
    setPendingFaturas([]);
    setSelectedFaturas({});
    setFaturaSearch('');
    setShowAllFaturas(false);
    setProofStep('upload');
    setShowProofModal(true);
  };

  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);

  const handleProofFileRaw = async (rawFile: File) => {
    if (rawFile.type.startsWith('image/')) {
      const src = URL.createObjectURL(rawFile);
      setCropImage({ src, callback: (blob: Blob) => {
        const cropped = new File([blob], rawFile.name, { type: 'image/jpeg' });
        setCropImage(null); URL.revokeObjectURL(src);
        proceedWithProofFile(cropped);
      }});
    } else {
      proceedWithProofFile(rawFile);
    }
  };

  const proceedWithProofFile = async (file: File) => {
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setProofScanning(true);
    setProofStep('review');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', 'comprovativo');
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.success && data?.data) {
        setProofData(data.data);
        // Carrega faturas correspondentes à entidade do comprovativo (NIF ou nome).
        setShowAllFaturas(false);
        setFaturaSearch('');
        const params = new URLSearchParams();
        if (data.data.nif) params.set('nif', data.data.nif);
        if (data.data.entidade) params.set('nome', data.data.entidade);
        const fatRes = await fetch(`/api/faturas/pendentes?${params.toString()}`);
        const fatData = await fatRes.json();
        setPendingFaturas(Array.isArray(fatData) ? fatData : []);
        toast.success('Dados do comprovativo extraídos!');
      } else {
        toast.error(data?.error || 'Não foi possível ler o comprovativo');
      }
    } catch {
      toast.error('Erro ao processar comprovativo');
    } finally {
      setProofScanning(false);
    }
  };

  const toggleFatura = (id: string) => {
    setSelectedFaturas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Recarrega a lista de faturas: só correspondentes (por entidade) ou todas as pendentes.
  const recarregarFaturas = async (todas: boolean) => {
    setShowAllFaturas(todas);
    const params = new URLSearchParams();
    if (!todas) {
      if (proofData?.nif) params.set('nif', proofData.nif);
      if (proofData?.entidade) params.set('nome', proofData.entidade);
    }
    try {
      const fatRes = await fetch(`/api/faturas/pendentes?${params.toString()}`);
      const fatData = await fatRes.json();
      setPendingFaturas(Array.isArray(fatData) ? fatData : []);
    } catch {
      toast.error('Erro ao carregar faturas');
    }
  };

  // Filtro de pesquisa por nome/número sobre a lista carregada.
  const faturasVisiveis = pendingFaturas.filter((f: any) => {
    if (!faturaSearch.trim()) return true;
    const s = faturaSearch.toLowerCase();
    return (
      (f.numero || '').toLowerCase().includes(s) ||
      (f.entidadeNome || '').toLowerCase().includes(s) ||
      (f.fornecedor?.nome || '').toLowerCase().includes(s)
    );
  });

  const selectedTotal = pendingFaturas
    .filter((f: any) => selectedFaturas[f.id])
    .reduce((sum: number, f: any) => sum + (f.saldoPendente || f.valor || 0), 0);

  const handleSaveProof = async () => {
    const selIds = Object.keys(selectedFaturas).filter((k) => selectedFaturas[k]);
    if (selIds.length === 0) { toast.error('Selecione pelo menos uma fatura'); return; }
    if (!proofFile) { toast.error('Sem comprovativo'); return; }
    setProofSaving(true);
    try {
      // Upload proof to S3
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `comprovativo_${proofFile.name}`, contentType: proofFile.type, isPublic: false }),
      });
      const { uploadUrl, cloud_storage_path } = await presignedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': proofFile.type }, body: proofFile });
      if (!uploadRes.ok) { toast.error('Erro no upload'); setProofSaving(false); return; }

      // Find the matched fornecedor
      const firstFatura = pendingFaturas.find((f: any) => selIds.includes(f.id));
      const fornecedorId = firstFatura?.fornecedorId || '';

      // Determine conta bancária from proof data (IBAN match)
      let contaBancariaId = '';
      if (proofData?.iban) {
        const matched = contas.find((c: any) => c?.iban && c.iban.replace(/\s/g, '') === proofData.iban.replace(/\s/g, ''));
        if (matched) contaBancariaId = matched.id;
      }

      // Create pagamento(s) for each selected fatura
      for (const faturaId of selIds) {
        const fat = pendingFaturas.find((f: any) => f.id === faturaId);
        const valorFatura = fat?.saldoPendente || fat?.valor || proofData?.valor || 0;
        const fatFornecedorId = fat?.fornecedorId || fornecedorId;
        await fetch('/api/pagamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: `Pag. ${fat?.numero || fat?.entidadeNome || 'fatura'}`,
            valor: valorFatura,
            dataPagamento: proofData?.data || new Date().toISOString().slice(0, 10),
            estado: 'pago',
            metodoPagamento: proofData?.metodo || 'transferência',
            referencia: proofData?.referencia || '',
            notas: '',
            comprovativoPath: cloud_storage_path,
            comprovativoContentType: proofFile.type,
            comprovativoOriginal: proofFile.name,
            fornecedorId: fatFornecedorId,
            contaBancariaId: contaBancariaId || null,
            faturaId,
          }),
        });
      }

      toast.success(`${selIds.length} pagamento(s) registado(s) com sucesso!`);
      setShowProofModal(false); load();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao guardar pagamentos');
    } finally { setProofSaving(false); }
  };

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={ArrowUpCircle} title="Pagamentos" description="Registar e gerir pagamentos a fornecedores" action={
        <div className="flex gap-2">
          <button onClick={openProofModal} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            <Receipt className="h-4 w-4" />Comprovativo
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <Plus className="h-4 w-4" />Novo Pagamento
          </button>
        </div>
      } />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por descrição, fornecedor, valor..." className="w-full pl-10 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary outline-none" /></div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground">
          <option value="data">Ordenar: Data de pagamento</option>
          <option value="atualizacao">Ordenar: Última atualização</option>
          <option value="valor_desc">Ordenar: Valor (maior primeiro)</option>
          <option value="valor_asc">Ordenar: Valor (menor primeiro)</option>
        </select>
      </div>

      {(() => { const filtered = items.filter(p => { if (!search) return true; const s = search.toLowerCase(); return p?.descricao?.toLowerCase().includes(s) || p?.fornecedor?.nome?.toLowerCase().includes(s) || p?.referencia?.toLowerCase().includes(s) || String(p?.valor)?.includes(s); }); const ts = (x: any) => x ? new Date(x).getTime() : 0; const sorted = [...filtered].sort((a: any, b: any) => { if (sortBy === 'atualizacao') return ts(b?.updatedAt) - ts(a?.updatedAt); if (sortBy === 'valor_desc') return Number(b?.valor ?? 0) - Number(a?.valor ?? 0); if (sortBy === 'valor_asc') return Number(a?.valor ?? 0) - Number(b?.valor ?? 0); return ts(b?.dataPagamento) - ts(a?.dataPagamento) || ts(b?.createdAt) - ts(a?.createdAt); }); return filtered.length === 0 ? <EmptyState icon={ArrowUpCircle} title="Sem pagamentos" description={search ? 'Nenhum resultado encontrado.' : 'Registe o primeiro pagamento.'} /> : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left px-4 py-3 font-medium">Descrição</th><th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Fornecedor</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Data</th><th className="text-right px-4 py-3 font-medium">Valor</th><th className="text-center px-4 py-3 font-medium">Estado</th><th className="text-right px-4 py-3 font-medium">Ações</th></tr></thead>
              <tbody>
                {sorted.map((p: any, idx: number) => (
                  <motion.tr key={p?.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p?.descricao}</div>
                      {p?.criadoPor && <div className="text-[11px] text-muted-foreground/70">por {p.criadoPor}</div>}
                      {p?.fatura?.numero && <div className="text-xs text-muted-foreground">Fatura: {p.fatura.numero}</div>}
                      {p?.reconciliado
                        ? <span className="inline-flex items-center gap-1 mt-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Conciliado</span>
                        : <span className="inline-flex items-center gap-1 mt-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Por conciliar</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p?.fornecedor?.nome ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(p?.dataPagamento)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-700">{formatCurrency(p?.valor)}</td>
                    <td className="px-4 py-3 text-center"><EstadoBadge estado={p?.estado} /></td>
                    <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1 flex-nowrap">
                      {p?.reciboPath && (<><button onClick={() => viewDoc(p, 'recibo')} className="p-1.5 rounded-md hover:bg-muted" title="Ver recibo do fornecedor"><Eye className="h-3.5 w-3.5 text-blue-600" /></button><button onClick={() => downloadDoc(p, 'recibo')} className="p-1.5 rounded-md hover:bg-muted" title="Transferir recibo do fornecedor"><Download className="h-3.5 w-3.5 text-blue-600" /></button></>)}
                      {p?.comprovativoPath && (<><button onClick={() => viewDoc(p, 'comprovativo')} className="p-1.5 rounded-md hover:bg-muted" title="Ver comprovativo"><Eye className="h-3.5 w-3.5 text-green-600" /></button><button onClick={() => downloadDoc(p, 'comprovativo')} className="p-1.5 rounded-md hover:bg-muted" title="Transferir comprovativo"><Download className="h-3.5 w-3.5 text-green-600" /></button></>)}
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-muted" title="Editar"><Edit2 className="h-3.5 w-3.5" /></button><button onClick={() => handleDelete(p?.id)} className="p-1.5 rounded-md hover:bg-destructive/10" title="Eliminar"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ); })()}

      {/* Payment Proof Modal */}
      <AnimatePresence>
        {showProofModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowProofModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-6 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Receipt className="h-5 w-5 text-amber-600" />Comprovativo de Pagamento</h2>
                <button onClick={() => setShowProofModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              {proofStep === 'upload' && (
                <div>
                  <div onClick={() => proofFileRef?.current?.click?.()} className="border-2 border-dashed border-amber-300 rounded-xl p-10 text-center cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                    <Camera className="h-12 w-12 mx-auto text-amber-500 mb-3" />
                    <p className="text-base font-medium text-foreground">Fotografe ou selecione o comprovativo</p>
                    <p className="text-sm text-muted-foreground mt-1">A IA irá extrair o valor e sugerir as faturas correspondentes</p>
                    <p className="text-xs text-muted-foreground mt-2">JPEG, PNG, PDF</p>
                  </div>
                  <input ref={proofFileRef} type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) handleProofFileRaw(f); }} className="hidden" />
                </div>
              )}

              {proofStep === 'review' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Preview */}
                    <div>
                      {proofPreview && proofFile?.type?.startsWith('image/') ? (
                        <img src={proofPreview} alt="Comprovativo" className="w-full rounded-lg border max-h-[300px] object-contain" />
                      ) : (
                        <div className="bg-muted rounded-lg p-8 text-center">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">{proofFile?.name}</p>
                        </div>
                      )}
                    </div>

                    {/* Extracted data */}
                    <div>
                      {proofScanning ? (
                        <div className="flex flex-col items-center justify-center h-full py-8">
                          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-3" />
                          <p className="text-sm font-medium">A analisar comprovativo...</p>
                        </div>
                      ) : proofData ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-600 mb-2">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium text-sm">Dados extraídos</span>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                            {proofData.valor && <div><span className="text-xs text-muted-foreground">Valor:</span> <span className="font-bold">{formatCurrency(proofData.valor)}</span></div>}
                            {proofData.data && <div><span className="text-xs text-muted-foreground">Data:</span> <span className="text-sm">{proofData.data}</span></div>}
                            {proofData.entidade && <div><span className="text-xs text-muted-foreground">Entidade:</span> <span className="text-sm">{proofData.entidade}</span></div>}
                            {proofData.metodo && <div><span className="text-xs text-muted-foreground">Método:</span> <span className="text-sm">{proofData.metodo}</span></div>}
                            {proofData.referencia && <div><span className="text-xs text-muted-foreground">Ref:</span> <span className="text-sm font-mono">{proofData.referencia}</span></div>}
                          </div>
                          <button onClick={() => setProofStep('select')} className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">Selecionar Faturas →</button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {proofStep === 'select' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <p className="text-sm"><strong>Valor do comprovativo:</strong> {proofData?.valor ? formatCurrency(proofData.valor) : 'N/D'}</p>
                    <p className="text-xs text-muted-foreground">
                      {showAllFaturas
                        ? 'A mostrar todas as faturas pendentes. Selecione as que este comprovativo paga.'
                        : (proofData?.entidade
                            ? <>A mostrar apenas faturas de <strong>{proofData.entidade}</strong>. Selecione as que este comprovativo paga.</>
                            : 'Selecione as faturas que este comprovativo paga.')}
                    </p>
                  </div>

                  {/* Pesquisa por nome + alternar entre correspondentes e todas */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        value={faturaSearch}
                        onChange={(e) => setFaturaSearch(e.target.value)}
                        placeholder="Pesquisar fatura por nome ou número..."
                        className="w-full pl-10 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => recarregarFaturas(!showAllFaturas)}
                      className="px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      {showAllFaturas ? 'Só correspondentes' : 'Ver todas as faturas'}
                    </button>
                  </div>

                  {pendingFaturas.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{showAllFaturas ? 'Nenhuma fatura pendente encontrada' : 'Nenhuma fatura pendente para esta entidade'}</p>
                      <p className="text-xs text-muted-foreground">{showAllFaturas ? 'Pode criar um pagamento manualmente' : 'Use “Ver todas as faturas” para procurar noutras entidades'}</p>
                    </div>
                  ) : faturasVisiveis.length === 0 ? (
                    <div className="text-center py-6">
                      <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma fatura corresponde à pesquisa</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {faturasVisiveis.map((f: any) => (
                        <label key={f.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedFaturas[f.id] ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400' : 'bg-muted/30 hover:bg-muted/50'}`}>
                          <input type="checkbox" checked={!!selectedFaturas[f.id]} onChange={() => toggleFatura(f.id)} className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{f.numero || f.entidadeNome || 'Sem número'}</p>
                              {f.fornecedor?.nome && <span className="text-xs text-muted-foreground">• {f.fornecedor.nome}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{f.dataEmissao ? formatDate(f.dataEmissao) : ''} {f.dataVencimento ? `• Venc: ${formatDate(f.dataVencimento)}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono font-bold">{formatCurrency(f.saldoPendente || f.valor)}</p>
                            {f.totalPago > 0 && <p className="text-xs text-muted-foreground">Pago: {formatCurrency(f.totalPago)}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {Object.values(selectedFaturas).some(Boolean) && (
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">{Object.values(selectedFaturas).filter(Boolean).length} fatura(s) selecionada(s)</span>
                        <span className="text-base font-bold">Total: {formatCurrency(selectedTotal)}</span>
                      </div>
                      {proofData?.valor && Math.abs(selectedTotal - proofData.valor) > 0.01 && (
                        <p className="text-xs text-amber-600 mb-2">⚠ O total selecionado ({formatCurrency(selectedTotal)}) difere do valor do comprovativo ({formatCurrency(proofData.valor)})</p>
                      )}
                      <button onClick={handleSaveProof} disabled={proofSaving} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                        {proofSaving ? <><Loader2 className="h-4 w-4 animate-spin" />A registar...</> : <><CheckCircle2 className="h-4 w-4" />Registar Pagamento(s)</>}
                      </button>
                    </div>
                  )}

                  <button onClick={() => setProofStep('review')} className="text-sm text-muted-foreground hover:underline">← Voltar</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">{editing ? 'Editar Pagamento' : 'Novo Pagamento'}</h2><button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Descrição *</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Valor (€) *</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
                <div><label className="block text-sm font-medium mb-1">Data *</label><input type="date" value={form.dataPagamento} onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{estados.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Método</label><select value={form.metodoPagamento} onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Não definido</option>{formasPagamento.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Fornecedor *</label><select value={form.fornecedorId} onChange={(e) => handlePickFornecedor(e.target.value)} required className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Selecione o fornecedor</option>{(fornecedores ?? []).map((f: any) => <option key={f?.id} value={f?.id}>{f?.nome}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Conta Bancária</label><select value={form.contaBancariaId} onChange={(e) => setForm({ ...form, contaBancariaId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem conta</option>{(contas ?? []).filter((c: any) => c?.ativa).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome} - {c?.banco}</option>)}</select></div>
              <div>
                <label className="block text-sm font-medium mb-1">Fatura a conciliar</label>
                {!form.fornecedorId ? (
                  <p className="text-xs text-muted-foreground px-3 py-2 border border-dashed border-input rounded-lg">Selecione primeiro o fornecedor para ver as faturas por conciliar.</p>
                ) : modalFaturas.length > 0 ? (
                  <select value={form.faturaId} onChange={(e) => handlePickFatura(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">
                    <option value="">Sem fatura associada</option>
                    {modalFaturas.map((fat: any) => (
                      <option key={fat?.id} value={fat?.id}>{(fat?.numero || fat?.entidadeNome || 'Fatura')} — {formatCurrency(Number(fat?.saldoPendente ?? fat?.valor ?? 0))}{fat?.dataEmissao ? ` (${formatDate(fat.dataEmissao)})` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground px-3 py-2 border border-dashed border-input rounded-lg">Sem faturas por conciliar para este fornecedor.</p>
                )}
              </div>
              <div><label className="block text-sm font-medium mb-1">Referência</label><input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div><label className="block text-sm font-medium mb-1">Notas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground resize-none" /></div>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-input bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={!!form.reconciliado} onChange={(e) => setForm({ ...form, reconciliado: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-input accent-red-600" />
                <span className="text-sm"><span className="font-medium">Registo direto — o valor saiu do banco (dispensa conciliação)</span><span className="block text-xs text-muted-foreground mt-0.5">Marque quando pagar uma fatura de fornecedor anterior que não consta nos registos. O pagamento fica registado sem passar pela conciliação.</span></span>
              </label>

              {/* Documentos: Recibo do fornecedor + Comprovativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([['recibo', 'Recibo do Fornecedor', reciboPreview, uploadingRecibo, reciboRef, form.reciboContentType, form.reciboOriginal], ['comprovativo', 'Comprovativo', comprovativoDocPreview, uploadingComprovativo, comprovativoDocRef, form.comprovativoContentType, form.comprovativoOriginal]] as const).map(([kind, label, preview, uploading, ref, ctype, original]) => (
                  <div key={kind}>
                    <label className="block text-sm font-medium mb-1">{label}</label>
                    {preview ? (
                      <div className="border border-input rounded-lg p-2 flex items-center gap-3">
                        {String(ctype).includes('pdf') ? (
                          <a href={preview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline"><FileText className="h-10 w-10" />Ver documento</a>
                        ) : (
                          <a href={preview} target="_blank" rel="noopener noreferrer" className="flex-shrink-0"><img src={preview} alt={label} className="h-16 w-16 object-cover rounded border" /></a>
                        )}
                        <span className="text-xs text-muted-foreground flex-1 truncate">{original || 'Documento carregado'}</span>
                        <button type="button" onClick={() => removeDoc(kind)} className="p-1.5 rounded hover:bg-destructive/10 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => ref.current?.click?.()} disabled={uploading} className="w-full border-2 border-dashed border-input rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-60">
                        {uploading ? <><Loader2 className="h-5 w-5 animate-spin" />A carregar...</> : <><Camera className="h-5 w-5" />Fotografar / carregar</>}
                      </button>
                    )}
                    <input ref={ref} type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) handleDocFileRaw(f, kind); e.currentTarget.value = ''; }} className="hidden" />
                  </div>
                ))}
              </div>

              <button type="submit" className="w-full py-2.5 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700">{editing ? 'Guardar' : 'Criar Pagamento'}</button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Document Preview Modal */}
      <AnimatePresence>
        {docPreview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDocPreview(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-4 w-full max-w-4xl shadow-xl max-h-[92vh] flex flex-col" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{docPreview.title}</h2>
                <div className="flex items-center gap-2">
                  <a href={docPreview.url} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"><Download className="h-4 w-4" />Transferir</a>
                  <button onClick={() => setDocPreview(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto rounded-lg bg-muted">
                {docPreview.contentType?.startsWith('image') ? (
                  <div className="relative w-full h-[70vh] flex items-center justify-center">
                    <img src={docPreview.url} alt={docPreview.title} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <iframe src={docPreview.url} title={docPreview.title} className="w-full h-[70vh] rounded-lg" />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}
    </div>
  );
}
