'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, X, Upload, Download, Eye, Search, Camera, Loader2, CheckCircle2, AlertCircle, Pencil, Settings, Tag, RotateCcw, Printer, ChevronLeft, ChevronRight, Maximize2, Link2, Landmark, Receipt, CreditCard, Smartphone, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { getPdfPageCount, splitPdfIntoPages } from '@/lib/pdf-split';
import { ImageCropModal } from '@/components/image-crop-modal';
import { useConfig } from '@/hooks/use-config';

const TIPO_LABELS_BASE: Record<string, string> = {
  emitida: 'Fatura Emitida',
  recebida: 'Fatura de Fornecedor',
  nota: 'Nota Créd/Déb',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
  orcamento: 'Orçamento',
  recibo: 'Recibo',
  guia: 'Guia',
};

const TIPO_COLORS_BASE: Record<string, string> = {
  emitida: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  recebida: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  nota: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  nota_credito: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  nota_debito: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  orcamento: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  recibo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  guia: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const ESTADO_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  fechado: 'Fechado',
  anulado: 'Anulado',
};

const ESTADO_COLORS: Record<string, string> = {
  rascunho: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  fechado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anulado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const DEFAULT_COLORS = ['bg-slate-100 text-slate-700','bg-indigo-100 text-indigo-700','bg-cyan-100 text-cyan-700','bg-pink-100 text-pink-700','bg-orange-100 text-orange-700','bg-lime-100 text-lime-700','bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-teal-100 text-teal-700','bg-fuchsia-100 text-fuchsia-700','bg-red-100 text-red-700','bg-emerald-100 text-emerald-700','bg-yellow-100 text-yellow-700','bg-gray-100 text-gray-700'];

const VIEW_TITLES: Record<string, string> = {
  'emitida:cliente': 'Faturas de Clientes',
  'recebida:fornecedor': 'Faturas de Fornecedores',
  'recibo:cliente': 'Recibos de Clientes',
  'recibo:fornecedor': 'Recibos de Fornecedores',
  'nota:cliente': 'Notas de Crédito (Clientes)',
  'nota:fornecedor': 'Notas de Crédito (Fornecedores)',
  'nota_credito:cliente': 'Notas de Crédito (Clientes)',
  'nota_credito:fornecedor': 'Notas de Crédito (Fornecedores)',
  'nota_debito:fornecedor': 'Notas de Débito (Fornecedores)',
  'orcamento:fornecedor': 'Orçamentos (Fornecedores)',
};

export default function FaturasPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
      <FaturasPageInner />
    </Suspense>
  );
}

function FaturasPageInner() {
  const searchParams = useSearchParams();
  const viewTipo = searchParams?.get('tipo') || '';
  const viewOrigem = searchParams?.get('origem') || '';
  const makeInitialForm = () => ({ numero: '', descricao: '', tipo: viewTipo === 'nota' ? 'nota_credito' : (viewTipo || 'recebida'), origem: viewOrigem || '', valor: '', dataEmissao: '', dataVencimento: '', clienteId: '', fornecedorId: '', categoria: 'outro', formaPagamento: '', entidadeNome: '', entidadeNif: '', valorBruto: '', impostos: '', faturaRelacionadaId: '' });
  const [faturas, setFaturas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [form, setForm] = useState<any>(makeInitialForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadOcrLoading, setUploadOcrLoading] = useState(false);
  const [uploadOcrDone, setUploadOcrDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);
  const versoScanRef = useRef<HTMLInputElement>(null);
  const versoUploadRef = useRef<HTMLInputElement>(null);
  const [versoScanFile, setVersoScanFile] = useState<File | null>(null);
  const [versoUploadFile, setVersoUploadFile] = useState<File | null>(null);
  const comprovativoUploadRef = useRef<HTMLInputElement>(null);
  const comprovativoScanRef = useRef<HTMLInputElement>(null);
  const comprovativoEditRef = useRef<HTMLInputElement>(null);
  const [comprovativoUploadFile, setComprovativoUploadFile] = useState<File | null>(null);
  const [comprovativoScanFile, setComprovativoScanFile] = useState<File | null>(null);
  const [comprovativoEditFile, setComprovativoEditFile] = useState<File | null>(null);
  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);
  const [pdfBatch, setPdfBatch] = useState<{ blob: Blob; name: string; pageNumber: number }[]>([]);
  const [pdfBatchIndex, setPdfBatchIndex] = useState(0);
  const [pdfSplitting, setPdfSplitting] = useState(false);
  const [pdfForms, setPdfForms] = useState<any[]>([]);
  const [pdfOcrStatus, setPdfOcrStatus] = useState<('pending' | 'loading' | 'done')[]>([]);
  const pdfIndexRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [editingFatura, setEditingFatura] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ numero: '', descricao: '', tipo: 'recebida', origem: '', valor: '', valorBruto: '', impostos: '', estado: 'rascunho', dataEmissao: '', dataVencimento: '', clienteId: '', fornecedorId: '', entidadeNome: '', entidadeNif: '', referencia: '', categoria: 'outro', formaPagamento: '', faturaRelacionadaId: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [sortBy, setSortBy] = useState('emissao');
  const [filterSerie, setFilterSerie] = useState('');
  const [filterValidacao, setFilterValidacao] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [validandoFatura, setValidandoFatura] = useState<any>(null);
  const [validForm, setValidForm] = useState<{ formaPagamento: string; dataPagamento: string }>({ formaPagamento: '', dataPagamento: '' });
  const [validSaving, setValidSaving] = useState(false);
  const [gerandoMB, setGerandoMB] = useState<string | null>(null);
  const [mbwayModal, setMbwayModal] = useState<any>(null);
  const [mbwayTel, setMbwayTel] = useState('');
  const [mbwayEnviando, setMbwayEnviando] = useState(false);
  const [verificandoPag, setVerificandoPag] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [reclassificando, setReclassificando] = useState(false);
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [reconciliandoMov, setReconciliandoMov] = useState<string | null>(null);
  const [modoManual, setModoManual] = useState(false);

  const [filterCategoria, setFilterCategoria] = useState('');
  const [categorias, setCategorias] = useState<any[]>([]);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [catForm, setCatForm] = useState({ nome: '', cor: '' });
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catSaving, setCatSaving] = useState(false);

  const catLabels: Record<string, string> = {};
  const catColors: Record<string, string> = {};
  categorias.forEach((c: any, i: number) => { catLabels[c.slug] = c.nome; catColors[c.slug] = c.cor || DEFAULT_COLORS[i % DEFAULT_COLORS.length]; });

  // Configurações dinâmicas
  const { labelMap: FORMAS_PAGAMENTO } = useConfig('forma_pagamento');
  const { items: tipoItems, labelMap: tipoDbLabels, corMap: tipoDbColors } = useConfig('tipo_documento');
  const TIPO_LABELS: Record<string, string> = { ...TIPO_LABELS_BASE, ...tipoDbLabels };
  const TIPO_COLORS: Record<string, string> = { ...TIPO_COLORS_BASE, ...tipoDbColors };

  // Notas de crédito/débito são tratadas como um único tipo "Nota" no menu/filtros
  const isNotaTipo = (t?: string) => t === 'nota' || t === 'nota_credito' || t === 'nota_debito';
  const tipoMatches = (fTipo?: string, vTipo?: string) => (vTipo === 'nota' ? isNotaTipo(fTipo) : fTipo === vTipo);
  const tipoOptions = [
    ...(tipoItems || []).filter((t: any) => !isNotaTipo(t.valor)),
    { valor: 'nota', label: 'Nota de Crédito/Débito' },
  ];

  // Vista de Faturas de Clientes (emitidas a clientes)
  const isClientesView = viewTipo === 'emitida' && viewOrigem === 'cliente';
  // Fatura anulada (não conta como emitida/validada)
  const isAnulada = (f: any) => (f?.estado || '').toLowerCase() === 'anulado';
  // Série LJOCC: faturas só emitidas depois de pagas -> auto-validadas (exceto anuladas)
  const isSerieAutoPaga = (serie?: string) => (serie || '').toUpperCase().startsWith('LJOCC');
  const isAutoValidada = (f: any) => !isAnulada(f) && isSerieAutoPaga(f?.serieName);
  // Fatura totalmente liquidada no Moloni (valor reconciliado >= valor) -> considerada recebida
  const isReconciliadaMoloni = (f: any) => { const v = Number(f?.valor) || 0; const r = Number(f?.valorReconciliado) || 0; return v > 0 && r >= v - 0.01; };
  const isPagamentoValidado = (f: any) => !isAnulada(f) && (isAutoValidada(f) || isReconciliadaMoloni(f) || !!f?.pagamentoValidado);
  // Localiza o recibo emitido que liquida esta fatura (mesmo cliente/NIF e valor igual)
  const findReciboFatura = (f: any) => faturas.find((r: any) => r?.tipo === 'recibo' && r?.origem === 'cliente' && !isAnulada(r) && (((r?.clienteId && f?.clienteId && r.clienteId === f.clienteId)) || ((r?.entidadeNif && f?.entidadeNif && (r.entidadeNif || '').replace(/\s/g, '') === (f.entidadeNif || '').replace(/\s/g, '')))) && Math.abs((Number(r?.valor) || 0) - (Number(f?.valor) || 0)) < 0.01);

  const load = async () => {
    try {
      const [f, c, fo, cats] = await Promise.all([fetch('/api/faturas').then((x) => x.json()), fetch('/api/clientes').then((x) => x.json()), fetch('/api/fornecedores').then((x) => x.json()), fetch('/api/categorias').then((x) => x.json())]);
      setFaturas(f ?? []); setClientes(c ?? []); setFornecedores(fo ?? []); setCategorias(cats ?? []);
      if (isClientesView) {
        try { const m = await fetch('/api/movimentos').then((x) => x.json()); setMovimentos(Array.isArray(m) ? m : []); } catch { /* ignore */ }
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Pré-visualização do ficheiro atualmente selecionado no modal de upload
  useEffect(() => {
    if (!selectedFile) { setSelectedFilePreview(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setSelectedFilePreview(url);
    return () => { URL.revokeObjectURL(url); };
  }, [selectedFile]);

  // Encontra o fornecedor já registado que corresponde aos dados lidos do documento
  const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
  const matchFornecedorId = (nif?: string, nome?: string): string => {
    const nifClean = (nif || '').replace(/\s/g, '').trim();
    if (nifClean) {
      const byNif = fornecedores.find((f: any) => (f?.nif || '').replace(/\s/g, '').trim() === nifClean);
      if (byNif) return byNif.id;
    }
    const nomeNorm = norm(nome);
    if (nomeNorm && nomeNorm.length >= 3) {
      const byName = fornecedores.find((f: any) => {
        const fn = norm(f?.nome);
        return fn && (fn === nomeNorm || fn.includes(nomeNorm) || nomeNorm.includes(fn));
      });
      if (byName) return byName.id;
    }
    return '';
  };

  const handleSaveCat = async () => {
    if (!catForm.nome.trim()) { toast.error('Preencha o nome'); return; }
    setCatSaving(true);
    try {
      const url = editingCat ? `/api/categorias/${editingCat.id}` : '/api/categorias';
      const method = editingCat ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
      if (!r.ok) { const d = await r.json(); toast.error(d?.error || 'Erro'); return; }
      toast.success(editingCat ? 'Categoria atualizada' : 'Categoria criada');
      setCatForm({ nome: '', cor: '' }); setEditingCat(null);
      const cats = await fetch('/api/categorias').then(x => x.json()); setCategorias(cats ?? []);
    } catch { toast.error('Erro'); } finally { setCatSaving(false); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Eliminar categoria?')) return;
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
    toast.success('Categoria eliminada');
    const cats = await fetch('/api/categorias').then(x => x.json()); setCategorias(cats ?? []);
  };

  const filtered = faturas.filter((f: any) => {
    if (viewTipo && !tipoMatches(f?.tipo, viewTipo)) return false;
    if (viewOrigem && f?.origem !== viewOrigem) return false;
    if (!viewTipo && filterTipo && f?.tipo !== filterTipo) return false;

    if (filterCategoria && f?.categoria !== filterCategoria) return false;
    if (filterSerie && (f?.serieName || '') !== filterSerie) return false;
    if (filterEstado === 'anulado' && !isAnulada(f)) return false;
    if (filterEstado === 'ativo' && isAnulada(f)) return false;
    if (filterValidacao === 'validado' && (isAnulada(f) || !isPagamentoValidado(f))) return false;
    if (filterValidacao === 'por_validar' && (isAnulada(f) || isPagamentoValidado(f))) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (f?.numero?.toLowerCase()?.includes(s) || f?.descricao?.toLowerCase()?.includes(s) || f?.entidadeNome?.toLowerCase()?.includes(s) || f?.nomeOriginal?.toLowerCase()?.includes(s) || f?.cliente?.nome?.toLowerCase()?.includes(s) || f?.fornecedor?.nome?.toLowerCase()?.includes(s));
  });

  const ts = (v: any) => (v ? new Date(v).getTime() : 0);
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === 'atualizacao') return ts(b?.updatedAt) - ts(a?.updatedAt);
    if (sortBy === 'valor_desc') return (Number(b?.valor) || 0) - (Number(a?.valor) || 0);
    if (sortBy === 'valor_asc') return (Number(a?.valor) || 0) - (Number(b?.valor) || 0);
    // Por defeito: data de emissão (mais recente primeiro)
    const de = ts(b?.dataEmissao) - ts(a?.dataEmissao);
    if (de !== 0) return de;
    return ts(b?.createdAt) - ts(a?.createdAt);
  });

  const inView = Boolean(viewTipo || viewOrigem);
  const pageTitle = inView ? (VIEW_TITLES[`${viewTipo}:${viewOrigem}`] || (TIPO_LABELS_BASE[viewTipo] ?? 'Documentos')) : 'Documentos';
  const viewFaturas = inView ? faturas.filter((f: any) => (!viewTipo || tipoMatches(f?.tipo, viewTipo)) && (!viewOrigem || f?.origem === viewOrigem)) : faturas;
  // Séries distintas presentes na vista atual (para o filtro por série)
  const seriesDisponiveis = Array.from(new Set(viewFaturas.map((f: any) => f?.serieName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));

  const proceedWithScanFile = async (file: File) => {
    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
    setScanning(true);
    setScanResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', 'fatura');
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.success && data?.data) {
        setScanResult(data.data);
        // Corresponder fornecedor por NIF e, em fallback, por nome
        const matchedFornecedorId = matchFornecedorId(data.data.nif, data.data.fornecedor);
        // Auto-fill the form with scanned data
        setForm({
          numero: data.data.numero || '',
          descricao: data.data.descricao || '',
          tipo: 'recebida',
          valor: data.data.valor ? String(data.data.valor) : '',
          dataEmissao: data.data.data || '',
          dataVencimento: data.data.dataVencimento || '',
          clienteId: '',
          fornecedorId: matchedFornecedorId,
          categoria: 'outro',
          formaPagamento: '',
        });
        toast.success('Dados extraídos com sucesso!');
        // Deteção de duplicados
        const ocrNum = (data.data.numero || '').trim().toLowerCase();
        const ocrValor = data.data.valor ? Number(data.data.valor) : null;
        const ocrNif = (data.data.nif || '').trim();
        if (ocrNum || (ocrValor && ocrNif)) {
          const dup = faturas.find((f: any) => {
            const fNum = (f?.numero || '').trim().toLowerCase();
            const fNif = (f?.entidadeNif || f?.fornecedor?.nif || '').trim();
            const fVal = f?.valor ? Number(f.valor) : null;
            if (ocrNum && fNum && ocrNum === fNum) {
              if (ocrNif && fNif && ocrNif === fNif) return true;
              if (ocrValor && fVal && Math.abs(ocrValor - fVal) < 0.02) return true;
              if (!ocrNif && !ocrValor) return true;
            }
            return false;
          });
          if (dup) {
            toast.warning(`⚠️ Possível duplicado: fatura ${dup.numero || ''} de ${dup.entidadeNome || dup.fornecedor?.nome || 'N/D'} (${dup.valor ? formatCurrency(dup.valor) : ''})`, { duration: 8000 });
          }
        }
      } else {
        toast.error(data?.error || 'Não foi possível extrair dados');
      }
    } catch {
      toast.error('Erro ao processar imagem');
    } finally {
      setScanning(false);
    }
  };

  // OCR Scan handler - with crop step for images
  const handleScanFile = async (rawFile: File) => {
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({
        src,
        callback: (blob: Blob) => {
          const cropped = new File([blob], file.name, { type: 'image/jpeg' });
          setCropImage(null);
          URL.revokeObjectURL(src);
          proceedWithScanFile(cropped);
        },
      });
    } else {
      proceedWithScanFile(file);
    }
  };

  const handleSaveScan = async () => {
    if (!scanFile) { toast.error('Sem ficheiro'); return; }
    setUploading(true);
    try {
      // 1. Upload file to S3
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: scanFile.name, contentType: scanFile.type, isPublic: false }),
      });
      const { uploadUrl, cloud_storage_path } = await presignedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': scanFile.type, 'Content-Disposition': 'attachment' }, body: scanFile });
      if (!uploadRes.ok) { toast.error('Erro no upload'); setUploading(false); return; }

      // 2. Upload verso if exists
      let versoPath = null, versoContentType = null, versoOriginal = null;
      if (versoScanFile) {
        const vRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: versoScanFile.name, contentType: versoScanFile.type, isPublic: false }) });
        const vPres = await vRes.json();
        await fetch(vPres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': versoScanFile.type }, body: versoScanFile });
        versoPath = vPres.cloud_storage_path; versoContentType = versoScanFile.type; versoOriginal = versoScanFile.name;
      }

      // 2b. Upload comprovativo de pagamento if exists
      let comprovativoPath = null, comprovativoContentType = null, comprovativoOriginal = null;
      if (comprovativoScanFile) {
        const cRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: comprovativoScanFile.name, contentType: comprovativoScanFile.type, isPublic: false }) });
        const cPres = await cRes.json();
        await fetch(cPres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': comprovativoScanFile.type }, body: comprovativoScanFile });
        comprovativoPath = cPres.cloud_storage_path; comprovativoContentType = comprovativoScanFile.type; comprovativoOriginal = comprovativoScanFile.name;
      }

      // 3. Create fatura record
      const faturaRes = await fetch('/api/faturas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          valor: form.valor ? Number(form.valor) : null,
          cloudStoragePath: cloud_storage_path,
          isPublic: false,
          contentType: scanFile.type,
          nomeOriginal: scanFile.name,
          entidadeNome: scanResult?.fornecedor || null,
          entidadeNif: scanResult?.nif || null,
          valorBruto: scanResult?.valorBase || null,
          impostos: scanResult?.iva || null,
          versoPath, versoContentType, versoOriginal,
          comprovativoPath, comprovativoContentType, comprovativoOriginal,
        }),
      });
      if (!faturaRes.ok) { toast.error('Erro ao guardar fatura'); setUploading(false); return; }
      toast.success('Fatura digitalizada e guardada!');
      setShowScanModal(false); setScanFile(null); setScanResult(null); setScanPreview(null); setVersoScanFile(null); setComprovativoScanFile(null); load();
    } catch { toast.error('Erro'); } finally { setUploading(false); }
  };

  const proceedWithUploadFile = async (file: File) => {
    setSelectedFile(file);
    setUploadOcrDone(false);
    setUploadOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', 'fatura');
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.success && data?.data) {
        const matchedFornecedorId = matchFornecedorId(data.data.nif, data.data.fornecedor);
        if (matchedFornecedorId) {
          const fn = fornecedores.find((f: any) => f?.id === matchedFornecedorId);
          if (fn) toast.success(`Fornecedor identificado: ${fn.nome}`);
        }
        setForm((prev: any) => ({
          ...prev,
          numero: data.data.numero || prev.numero || '',
          descricao: data.data.descricao || prev.descricao || '',
          valor: data.data.valor ? String(data.data.valor) : prev.valor || '',
          dataEmissao: data.data.data || prev.dataEmissao || '',
          dataVencimento: data.data.dataVencimento || prev.dataVencimento || '',
          fornecedorId: matchedFornecedorId || prev.fornecedorId || '',
          entidadeNome: data.data.fornecedor || prev.entidadeNome || '',
          entidadeNif: data.data.nif || prev.entidadeNif || '',
          valorBruto: data.data.valorBase ? String(data.data.valorBase) : prev.valorBruto || '',
          impostos: data.data.iva ? String(data.data.iva) : prev.impostos || '',
        }));
        setUploadOcrDone(true);
        toast.success('Dados extraídos do documento!');
        // Deteção de duplicados
        const ocrNum = (data.data.numero || '').trim().toLowerCase();
        const ocrValor = data.data.valor ? Number(data.data.valor) : null;
        const ocrNif = (data.data.nif || '').trim();
        if (ocrNum || (ocrValor && ocrNif)) {
          const dup = faturas.find((f: any) => {
            const fNum = (f?.numero || '').trim().toLowerCase();
            const fNif = (f?.entidadeNif || f?.fornecedor?.nif || '').trim();
            const fVal = f?.valor ? Number(f.valor) : null;
            if (ocrNum && fNum && ocrNum === fNum) {
              if (ocrNif && fNif && ocrNif === fNif) return true;
              if (ocrValor && fVal && Math.abs(ocrValor - fVal) < 0.02) return true;
              if (!ocrNif && !ocrValor) return true;
            }
            return false;
          });
          if (dup) {
            toast.warning(`⚠️ Possível duplicado: fatura ${dup.numero || ''} de ${dup.entidadeNome || dup.fornecedor?.nome || 'N/D'} (${dup.valor ? formatCurrency(dup.valor) : ''})`, { duration: 8000 });
          }
        }
      }
    } catch { /* OCR failed silently, user fills manually */ }
    finally { setUploadOcrLoading(false); }
  };

  // Lê o OCR de uma página específica do lote (uma só vez) e preenche o formulário dessa página
  const runOcrForPage = async (index: number, file: File) => {
    setPdfOcrStatus((prev) => { const c = [...prev]; c[index] = 'loading'; return c; });
    setUploadOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', 'fatura');
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.success && data?.data) {
        const matched = matchFornecedorId(data.data.nif, data.data.fornecedor);
        const patch: any = {
          numero: data.data.numero || '',
          descricao: data.data.descricao || '',
          valor: data.data.valor ? String(data.data.valor) : '',
          dataEmissao: data.data.data || '',
          dataVencimento: data.data.dataVencimento || '',
          fornecedorId: matched || '',
          entidadeNome: data.data.fornecedor || '',
          entidadeNif: data.data.nif || '',
          valorBruto: data.data.valorBase ? String(data.data.valorBase) : '',
          impostos: data.data.iva ? String(data.data.iva) : '',
        };
        // Guarda no formulário da página (sem apagar dados já introduzidos manualmente)
        setPdfForms((prev) => {
          const c = [...prev];
          const cur = c[index] || makeInitialForm();
          const merged = { ...cur };
          Object.keys(patch).forEach((k) => { if (!merged[k] && patch[k]) merged[k] = patch[k]; });
          c[index] = merged;
          // Se o utilizador ainda está a ver esta página, atualiza o formulário visível
          if (pdfIndexRef.current === index) setForm(merged);
          return c;
        });
        if (matched) {
          const fn = fornecedores.find((f: any) => f?.id === matched);
          if (fn && pdfIndexRef.current === index) toast.success(`Fornecedor identificado: ${fn.nome}`);
        }
      }
    } catch { /* falha silenciosa — preenchimento manual */ }
    finally {
      setPdfOcrStatus((prev) => { const c = [...prev]; c[index] = 'done'; return c; });
      setUploadOcrLoading(false);
    }
  };

  // Navega livremente entre as páginas do lote, sem obrigar a guardar
  const goToPage = async (target: number) => {
    if (target < 0 || target >= pdfBatch.length || target === pdfBatchIndex) return;
    // Preserva os dados da página atual
    const updated = [...pdfForms];
    updated[pdfBatchIndex] = form;
    setPdfForms(updated);
    // Muda para a página alvo
    setPdfBatchIndex(target);
    pdfIndexRef.current = target;
    setForm(updated[target] || makeInitialForm());
    const page = pdfBatch[target];
    const file = new File([page.blob], page.name, { type: 'application/pdf' });
    setSelectedFile(file);
    // Lê o OCR se ainda não tiver sido lido
    if (pdfOcrStatus[target] !== 'done' && pdfOcrStatus[target] !== 'loading') {
      runOcrForPage(target, file);
    }
  };

  // Cria uma fatura a partir de um ficheiro + dados de formulário
  const uploadOneFatura = async (file: File, formData: any, verso: File | null, comprovativo: File | null = null): Promise<boolean> => {
    try {
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
      });
      const { uploadUrl, cloud_storage_path } = await presignedRes.json();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!uploadRes.ok) return false;
      let versoPath = null, versoContentType = null, versoOriginal = null;
      if (verso) {
        const vRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: verso.name, contentType: verso.type, isPublic: false }) });
        const vPres = await vRes.json();
        await fetch(vPres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': verso.type }, body: verso });
        versoPath = vPres.cloud_storage_path; versoContentType = verso.type; versoOriginal = verso.name;
      }
      let comprovativoPath = null, comprovativoContentType = null, comprovativoOriginal = null;
      if (comprovativo) {
        const cRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: comprovativo.name, contentType: comprovativo.type, isPublic: false }) });
        const cPres = await cRes.json();
        await fetch(cPres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': comprovativo.type }, body: comprovativo });
        comprovativoPath = cPres.cloud_storage_path; comprovativoContentType = comprovativo.type; comprovativoOriginal = comprovativo.name;
      }
      const faturaRes = await fetch('/api/faturas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, valor: formData.valor ? Number(formData.valor) : null, cloudStoragePath: cloud_storage_path, isPublic: false, contentType: file.type, nomeOriginal: file.name, versoPath, versoContentType, versoOriginal, comprovativoPath, comprovativoContentType, comprovativoOriginal }),
      });
      return faturaRes.ok;
    } catch { return false; }
  };

  const resetUploadState = () => {
    setShowModal(false); setSelectedFile(null); setUploadOcrDone(false); setVersoUploadFile(null); setComprovativoUploadFile(null);
    setPdfBatch([]); setPdfBatchIndex(0); setPdfForms([]); setPdfOcrStatus([]); pdfIndexRef.current = 0;
  };

  // Guarda todas as faturas do lote de uma só vez
  const handleSaveAllBatch = async () => {
    const forms = [...pdfForms];
    forms[pdfBatchIndex] = form;
    setUploading(true);
    let saved = 0;
    for (let i = 0; i < pdfBatch.length; i++) {
      const page = pdfBatch[i];
      const file = new File([page.blob], page.name, { type: 'application/pdf' });
      const ok = await uploadOneFatura(file, forms[i] || makeInitialForm(), null);
      if (ok) saved++;
    }
    setUploading(false);
    if (saved === pdfBatch.length) toast.success(`Todas as ${pdfBatch.length} faturas foram guardadas!`);
    else toast.warning(`${saved} de ${pdfBatch.length} faturas guardadas. Verifique as restantes.`);
    resetUploadState();
    load();
  };

  const handleUploadFileSelect = async (rawFile: File | null) => {
    if (!rawFile) { setSelectedFile(null); setUploadOcrDone(false); return; }
    // Novo ficheiro selecionado — limpar qualquer lote anterior
    setPdfBatch([]); setPdfBatchIndex(0); setPdfForms([]); setPdfOcrStatus([]); pdfIndexRef.current = 0;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({
        src,
        callback: (blob: Blob) => {
          const cropped = new File([blob], file.name, { type: 'image/jpeg' });
          setCropImage(null);
          URL.revokeObjectURL(src);
          proceedWithUploadFile(cropped);
        },
      });
    } else if (file.type === 'application/pdf') {
      // Deteta PDFs com várias páginas e divide cada página numa fatura separada
      setPdfSplitting(true);
      try {
        const count = await getPdfPageCount(file);
        if (count > 1) {
          const pages = await splitPdfIntoPages(file);
          setPdfBatch(pages);
          setPdfBatchIndex(0);
          pdfIndexRef.current = 0;
          setPdfForms(pages.map(() => makeInitialForm()));
          setPdfOcrStatus(pages.map(() => 'pending'));
          setForm(makeInitialForm());
          toast.success(`Documento com ${count} páginas detetado — serão criadas ${count} faturas. Navegue entre as páginas e preencha cada uma.`, { duration: 7000 });
          const first = new File([pages[0].blob], pages[0].name, { type: 'application/pdf' });
          setSelectedFile(first);
          runOcrForPage(0, first);
        } else {
          await proceedWithUploadFile(file);
        }
      } catch {
        // Se a leitura falhar, trata como ficheiro único
        setPdfBatch([]); setPdfBatchIndex(0); setPdfForms([]); setPdfOcrStatus([]);
        await proceedWithUploadFile(file);
      } finally {
        setPdfSplitting(false);
      }
    } else {
      proceedWithUploadFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lote de PDF multipágina: guarda todas as faturas de uma só vez
    if (pdfBatch.length > 1) { await handleSaveAllBatch(); return; }
    if (!selectedFile) { toast.error('Selecione um ficheiro'); return; }
    setUploading(true);
    try {
      const ok = await uploadOneFatura(selectedFile, form, versoUploadFile, comprovativoUploadFile);
      if (!ok) { toast.error('Erro ao guardar fatura'); setUploading(false); return; }
      toast.success('Fatura carregada com sucesso');
      resetUploadState();
      load();
    } catch { toast.error('Erro no upload'); } finally { setUploading(false); }
  };

  const handleView = async (id: string, contentType: string, verso?: boolean, comprovativo?: boolean) => {
    try {
      const res = await fetch(`/api/faturas/${id}/url?inline=1`);
      const data = await res.json();
      const url = comprovativo ? data?.comprovativoUrl : verso ? data?.versoUrl : data?.url;
      if (url) { setPreviewUrl(url); setPreviewType(contentType); }
      else if (comprovativo) { toast.error('Sem comprovativo disponível'); }
      else if (verso) { toast.error('Sem verso disponível'); }
    } catch { toast.error('Erro ao obter ficheiro'); }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/faturas/${id}/url`);
      const data = await res.json();
      if (data?.url) { const a = document.createElement('a'); a.href = data.url; a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    } catch { toast.error('Erro ao descarregar'); }
  };

  const handleEdit = (f: any) => {
    setEditForm({
      numero: f?.numero || '',
      descricao: f?.descricao || '',
      tipo: f?.tipo || 'recebida',
      origem: f?.origem || '',
      valor: f?.valor ? String(f.valor) : '',
      valorBruto: f?.valorBruto ? String(f.valorBruto) : '',
      impostos: f?.impostos ? String(f.impostos) : '',
      estado: f?.estado || 'rascunho',
      dataEmissao: f?.dataEmissao ? new Date(f.dataEmissao).toISOString().split('T')[0] : '',
      dataVencimento: f?.dataVencimento ? new Date(f.dataVencimento).toISOString().split('T')[0] : '',
      clienteId: f?.clienteId || '',
      fornecedorId: f?.fornecedorId || '',
      entidadeNome: f?.entidadeNome || '',
      entidadeNif: f?.entidadeNif || '',
      referencia: f?.referencia || '',
      categoria: f?.categoria || 'outro',
      formaPagamento: f?.formaPagamento || '',
      faturaRelacionadaId: f?.faturaRelacionadaId || '',
    });
    setEditingFatura(f);
  };

  const handleSaveEdit = async () => {
    if (!editingFatura) return;
    setEditSaving(true);
    try {
      let comprovativoFields: any = {};
      if (comprovativoEditFile) {
        const cRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: comprovativoEditFile.name, contentType: comprovativoEditFile.type, isPublic: false }) });
        const cPres = await cRes.json();
        await fetch(cPres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': comprovativoEditFile.type }, body: comprovativoEditFile });
        comprovativoFields = { comprovativoPath: cPres.cloud_storage_path, comprovativoContentType: comprovativoEditFile.type, comprovativoOriginal: comprovativoEditFile.name };
      }
      const res = await fetch(`/api/faturas/${editingFatura.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          ...comprovativoFields,
          valor: editForm.valor ? Number(editForm.valor) : null,
          valorBruto: editForm.valorBruto ? Number(editForm.valorBruto) : null,
          impostos: editForm.impostos ? Number(editForm.impostos) : null,
        }),
      });
      if (res.ok) {
        toast.success('Fatura atualizada com sucesso');
        setComprovativoEditFile(null);
        setEditingFatura(null);
        load();
      } else {
        const data = await res.json();
        toast.error(data?.error || 'Erro ao atualizar');
      }
    } catch { toast.error('Erro ao atualizar'); } finally { setEditSaving(false); }
  };

  const abrirValidacao = (f: any) => {
    setValidForm({ formaPagamento: f?.formaPagamento || '', dataPagamento: f?.dataPagamento ? new Date(f.dataPagamento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
    setModoManual(false);
    setValidandoFatura(f);
  };

  // Movimentos bancários (crédito, não reconciliados) sugeridos para uma fatura,
  // ordenados por proximidade de valor e depois de data
  const sugestoesMovimentos = (f: any) => {
    if (!f) return [] as any[];
    const alvo = f?.valor ?? 0;
    const emissao = f?.dataEmissao ? new Date(f.dataEmissao).getTime() : null;
    return (movimentos ?? [])
      .filter((m: any) => !m?.reconciliado && m?.tipo === 'credito')
      .map((m: any) => {
        const diffValor = Math.abs((m?.valor || 0) - alvo);
        const diffDias = emissao ? Math.abs(new Date(m?.dataMovimento).getTime() - emissao) / 86400000 : 99999;
        return { ...m, __diffValor: diffValor, __valorMatch: diffValor < 0.01, __diffDias: diffDias };
      })
      .sort((a: any, b: any) => (a.__diffValor - b.__diffValor) || (a.__diffDias - b.__diffDias))
      .slice(0, 8);
  };

  // Concilia a fatura com um movimento bancário -> cria recebimento e valida o pagamento
  const conciliarComMovimento = async (movimentoId: string) => {
    if (!validandoFatura) return;
    setReconciliandoMov(movimentoId);
    try {
      const res = await fetch('/api/reconciliacao/fatura-cliente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movimentoId, faturaId: validandoFatura.id }),
      });
      if (res.ok) { toast.success('Pagamento validado e conciliado com o movimento bancário'); setValidandoFatura(null); load(); }
      else { const d = await res.json(); toast.error(d?.error || 'Erro ao conciliar'); }
    } catch { toast.error('Erro ao conciliar'); } finally { setReconciliandoMov(null); }
  };

  const confirmarValidacao = async () => {
    if (!validandoFatura) return;
    if (!validForm.formaPagamento) { toast.error('Indique a forma de pagamento'); return; }
    if (!validForm.dataPagamento) { toast.error('Indique a data de pagamento'); return; }
    setValidSaving(true);
    try {
      const res = await fetch(`/api/faturas/${validandoFatura.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamentoValidado: true, formaPagamento: validForm.formaPagamento, dataPagamento: validForm.dataPagamento }),
      });
      if (res.ok) { toast.success('Pagamento validado'); setValidandoFatura(null); load(); }
      else { const d = await res.json(); toast.error(d?.error || 'Erro ao validar'); }
    } catch { toast.error('Erro ao validar'); } finally { setValidSaving(false); }
  };

  const handleGerarMB = async (f: any) => {
    setGerandoMB(f.id);
    try {
      const res = await fetch(`/api/faturas/${f.id}/multibanco`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        toast.success(d?.reutilizada ? 'Referência Multibanco existente' : 'Referência Multibanco gerada');
        load();
      } else {
        toast.error(d?.error || 'Erro ao gerar referência');
      }
    } catch { toast.error('Erro ao gerar referência'); } finally { setGerandoMB(null); }
  };

  const enviarMBWay = async () => {
    if (!mbwayModal) return;
    const tel = mbwayTel.trim();
    if (!tel) { toast.error('Indique o número de telemóvel'); return; }
    setMbwayEnviando(true);
    try {
      const res = await fetch(`/api/faturas/${mbwayModal.id}/mbway`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemovel: tel }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d?.message || 'Pedido MB WAY enviado. Confirme na app MB WAY.');
        setMbwayModal(null); setMbwayTel(''); load();
      } else {
        toast.error(d?.error || 'Erro ao iniciar pagamento MB WAY');
      }
    } catch { toast.error('Erro ao iniciar pagamento MB WAY'); } finally { setMbwayEnviando(false); }
  };

  const verificarPagamento = async (f: any) => {
    setVerificandoPag(f.id);
    try {
      const res = await fetch(`/api/faturas/${f.id}/verificar-pagamento`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        if (d?.paga) { toast.success(d?.message || 'Pagamento confirmado. Fatura marcada como paga.'); load(); }
        else { toast.info(d?.message || 'Ainda sem confirmação de pagamento no IfThenPay.'); }
      } else {
        toast.error(d?.message || d?.error || 'Não foi possível verificar o pagamento.');
      }
    } catch { toast.error('Erro ao verificar pagamento'); } finally { setVerificandoPag(null); }
  };

  const sincronizarPagamentos = async () => {
    setSincronizando(true);
    try {
      const res = await fetch('/api/faturas/sincronizar-pagamentos', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        if (d?.confirmadas > 0) { toast.success(d?.message || `${d.confirmadas} fatura(s) confirmada(s).`); load(); }
        else { toast.info(d?.message || 'Nenhum novo pagamento encontrado no IfThenPay.'); }
      } else {
        toast.error(d?.error || 'Não foi possível sincronizar os pagamentos.');
      }
    } catch { toast.error('Erro ao sincronizar pagamentos'); } finally { setSincronizando(false); }
  };

  const reclassificarCategorias = async () => {
    if (!confirm('Corrigir automaticamente a categoria das faturas de fornecedor que estão sem categoria ou em “Outro”? As faturas já classificadas noutra categoria não são alteradas.')) return;
    setReclassificando(true);
    try {
      const res = await fetch('/api/faturas/reclassificar', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        if (d?.atualizadas > 0) { toast.success(`${d.atualizadas} fatura(s) reclassificada(s) de ${d.analisadas} analisada(s).`); load(); }
        else { toast.info(`Nenhuma fatura foi alterada (${d?.analisadas ?? 0} analisada(s)).`); }
      } else {
        toast.error(d?.error || 'Não foi possível corrigir as categorias.');
      }
    } catch { toast.error('Erro ao corrigir categorias'); } finally { setReclassificando(false); }
  };

  const copiarTexto = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success('Copiado'); } catch { /* noop */ }
  };

  const reverterValidacao = async (f: any) => {
    if (!confirm('Reverter a validação do pagamento desta fatura?')) return;
    try {
      const res = await fetch(`/api/faturas/${f.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamentoValidado: false }),
      });
      if (res.ok) { toast.success('Validação revertida'); load(); }
      else { toast.error('Erro'); }
    } catch { toast.error('Erro'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que quer eliminar este documento?')) return;
    await fetch(`/api/faturas/${id}`, { method: 'DELETE' });
    toast.success('Documento eliminado'); load();
  };

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title={pageTitle} description={`${viewFaturas.length} documentos registados`} action={
        <div className="flex gap-2">
          {isClientesView && (
            <button onClick={sincronizarPagamentos} disabled={sincronizando} className="flex items-center gap-2 px-4 py-2.5 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-60" title="Ir ao IfThenPay buscar pagamentos e marcar as faturas pagas">
              <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'A sincronizar...' : 'Sincronizar pagamentos'}
            </button>
          )}
          <button onClick={() => { setCatForm({ nome: '', cor: '' }); setEditingCat(null); setShowCategoriasModal(true); }} className="flex items-center gap-2 px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors" title="Gerir Categorias">
            <Tag className="h-4 w-4" />Categorias
          </button>
          {!isClientesView && (
            <button onClick={reclassificarCategorias} disabled={reclassificando} className="flex items-center gap-2 px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60" title="Corrigir automaticamente a categoria das faturas sem categoria ou em Outro">
              <Sparkles className={`h-4 w-4 ${reclassificando ? 'animate-pulse' : ''}`} />{reclassificando ? 'A corrigir...' : 'Corrigir categorias'}
            </button>
          )}
          <button onClick={() => { setScanFile(null); setScanResult(null); setScanPreview(null); setVersoScanFile(null); setShowScanModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            <Camera className="h-4 w-4" />Digitalizar Fatura
          </button>
          <button onClick={() => { setForm(makeInitialForm()); setSelectedFile(null); setVersoUploadFile(null); setUploadOcrDone(false); setPdfBatch([]); setPdfBatchIndex(0); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" />Carregar Documento
          </button>
        </div>
      } />

      {isClientesView && (() => {
        const ativas = viewFaturas.filter((f: any) => !isAnulada(f));
        const totalValor = ativas.reduce((s: number, f: any) => s + (Number(f?.valor) || 0), 0);
        const recebidas = ativas.filter((f: any) => isPagamentoValidado(f));
        const recebidasValor = recebidas.reduce((s: number, f: any) => s + (Number(f?.valor) || 0), 0);
        const porReceber = ativas.filter((f: any) => !isPagamentoValidado(f));
        const porReceberValor = porReceber.reduce((s: number, f: any) => s + (Number(f?.valor) || 0), 0);
        const now = Date.now();
        const vencidas = porReceber.filter((f: any) => f?.dataVencimento && new Date(f.dataVencimento).getTime() < now);
        const vencidasValor = vencidas.reduce((s: number, f: any) => s + (Number(f?.valor) || 0), 0);
        const cards = [
          { label: 'Total emitido', filterKey: '', count: ativas.length, valor: totalValor, Icon: FileText, color: 'text-foreground', accent: 'hover:ring-primary/40' },
          { label: 'Recebido', filterKey: 'validado', count: recebidas.length, valor: recebidasValor, Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', accent: 'hover:ring-emerald-400/50' },
          { label: 'Por receber', filterKey: 'por_validar', count: porReceber.length, valor: porReceberValor, Icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', accent: 'hover:ring-amber-400/50' },
          { label: 'Vencidas', filterKey: 'por_validar', count: vencidas.length, valor: vencidasValor, Icon: CreditCard, color: 'text-rose-600 dark:text-rose-400', accent: 'hover:ring-rose-400/50' },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c) => {
              const active = c.filterKey !== '' && filterValidacao === c.filterKey;
              return (
                <button key={c.label} onClick={() => setFilterValidacao(filterValidacao === c.filterKey && c.filterKey !== '' ? '' : c.filterKey)} className={`text-left bg-card rounded-xl shadow-sm p-4 ring-1 transition-all hover:shadow-md ${active ? 'ring-2 ring-primary' : `ring-transparent ${c.accent}`}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                    <c.Icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                  <div className={`text-lg sm:text-xl font-bold font-mono ${c.color}`}>{formatCurrency(c.valor)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.count} {c.count === 1 ? 'fatura' : 'faturas'}</div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {viewFaturas.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por número, descrição, entidade..." className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
          {!inView && (
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground">
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          )}

          <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground">
            <option value="">Todas as categorias</option>
            {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {seriesDisponiveis.length > 1 && (
            <select value={filterSerie} onChange={(e) => setFilterSerie(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground" title="Filtrar por série">
              <option value="">Todas as séries</option>
              {seriesDisponiveis.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground" title="Filtrar por estado do documento">
            <option value="">Estado: todos</option>
            <option value="ativo">Ativas (não anuladas)</option>
            <option value="anulado">Anuladas</option>
          </select>

          {isClientesView && (
            <select value={filterValidacao} onChange={(e) => setFilterValidacao(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground" title="Filtrar por validação de pagamento">
              <option value="">Pagamento: todos</option>
              <option value="validado">Validado / Pago</option>
              <option value="por_validar">Por validar</option>
            </select>
          )}

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground" title="Ordenar">
            <option value="emissao">Data de emissão</option>
            <option value="atualizacao">Última atualização</option>
            <option value="valor_desc">Valor (maior primeiro)</option>
            <option value="valor_asc">Valor (menor primeiro)</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title={search || filterTipo || filterCategoria ? 'Sem resultados' : 'Sem documentos'} description={search || filterTipo || filterCategoria ? 'Nenhum documento corresponde aos filtros.' : 'Carregue o primeiro documento ou importe do Moloni.'} />
      ) : (
        <>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Documento</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Entidade</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Data</th>

                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Categoria</th>
                    {isClientesView && <th className="text-left px-4 py-3 font-medium">Pagamento</th>}
                    <th className="text-right px-4 py-3 font-medium">Valor</th>
                    <th className="text-right px-4 py-3 font-medium w-[210px] min-w-[210px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f: any) => (
                    <tr key={f?.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isAnulada(f) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isAnulada(f) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{f?.numero || f?.nomeOriginal || '-'}</span>
                          {isAnulada(f) && <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_COLORS.anulado}`}>Anulada</span>}
                        </div>
                        {f?.descricao && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{f.descricao}</div>}
                        {f?.moloniDocType && <div className="text-xs text-muted-foreground">{f.moloniDocType}</div>}
                        {(f?.criadoPor || f?.updatedAt) && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{f?.criadoPor ? `Registado por ${f.criadoPor}` : ''}{f?.criadoPor && f?.updatedAt ? ' · ' : ''}{f?.updatedAt ? `atualizado ${formatDate(f.updatedAt)}` : ''}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${TIPO_COLORS[f?.tipo] || TIPO_COLORS.emitida}`}>
                          {TIPO_LABELS[f?.tipo] || f?.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                        {f?.entidadeNome || f?.cliente?.nome || f?.fornecedor?.nome || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                        {f?.dataEmissao ? formatDate(f.dataEmissao) : '-'}
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell">
                        {f?.categoria && (
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${catColors[f.categoria] || catColors.outro}`}>
                            {catLabels[f.categoria] || f.categoria}
                          </span>
                        )}
                      </td>
                      {isClientesView && (
                        <td className="px-4 py-3">
                          {isAnulada(f) ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap" title="Documento anulado — não requer validação"><X className="h-3 w-3" />Anulada</span>
                          ) : isAutoValidada(f) ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap" title="Série LJOCC: emitida apenas após pagamento"><CheckCircle2 className="h-3 w-3" />Pago (automático)</span>
                          ) : f?.pagamentoValidado ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap w-fit"><CheckCircle2 className="h-3 w-3" />Validado</span>
                              {f?.dataPagamento && <span className="text-[11px] text-muted-foreground">{formatDate(f.dataPagamento)}</span>}
                              <button onClick={() => reverterValidacao(f)} className="text-[11px] text-muted-foreground hover:text-destructive underline w-fit">Reverter</button>
                            </div>
                          ) : isReconciliadaMoloni(f) ? (
                            (() => { const rec = findReciboFatura(f); return (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap w-fit" title="Fatura liquidada no Moloni (valor reconciliado)"><CheckCircle2 className="h-3 w-3" />Recebido</span>
                                {rec?.numero ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Receipt className="h-3 w-3" />Recibo {rec.numero}</span> : null}
                              </div>
                            ); })()
                          ) : (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 whitespace-nowrap"><AlertCircle className="h-3 w-3" />Por validar</span>
                              <button onClick={() => abrirValidacao(f)} className="text-[11px] text-primary hover:underline font-medium">Marcar como pago</button>
                              {f?.mbReferencia ? (
                                <div className="mt-1 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 text-[11px] leading-tight">
                                  <div className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1"><CreditCard className="h-3 w-3" />Multibanco</div>
                                  <button onClick={() => copiarTexto(f.mbEntidade)} className="block hover:underline" title="Copiar">Ent.: <span className="font-mono">{f.mbEntidade}</span></button>
                                  <button onClick={() => copiarTexto(f.mbReferencia)} className="block hover:underline" title="Copiar">Ref.: <span className="font-mono">{f.mbReferencia}</span></button>
                                  <div>Valor: <span className="font-mono">{formatCurrency(f.mbValor ?? f.valor)}</span></div>
                                </div>
                              ) : (
                                <button onClick={() => handleGerarMB(f)} disabled={gerandoMB === f.id} className="text-[11px] text-sky-700 dark:text-sky-300 hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"><CreditCard className="h-3 w-3" />{gerandoMB === f.id ? 'A gerar…' : 'Gerar ref. Multibanco'}</button>
                              )}
                              {f?.mbwayEstado === 'pendente' ? (
                                <div className="mt-1 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 text-[11px] leading-tight">
                                  <div className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1"><Smartphone className="h-3 w-3" />MB WAY</div>
                                  <div>A aguardar confirmação{f?.mbwayTelemovel ? <> em <span className="font-mono">{String(f.mbwayTelemovel).replace('#', ' ')}</span></> : null}</div>
                                  <button onClick={() => { setMbwayModal(f); setMbwayTel(''); }} className="text-rose-700 dark:text-rose-300 hover:underline font-medium">Reenviar pedido</button>
                                </div>
                              ) : (
                                <button onClick={() => { setMbwayModal(f); setMbwayTel(''); }} className="text-[11px] text-rose-700 dark:text-rose-300 hover:underline font-medium inline-flex items-center gap-1"><Smartphone className="h-3 w-3" />Pagar com MB WAY</button>
                              )}
                              {(f?.mbReferencia || f?.mbwayOrderId || f?.mbwayRequestId) && (
                                <button onClick={() => verificarPagamento(f)} disabled={verificandoPag === f.id} className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50" title="Ir ao IfThenPay confirmar se esta fatura já foi paga"><RefreshCw className={`h-3 w-3 ${verificandoPag === f.id ? 'animate-spin' : ''}`} />{verificandoPag === f.id ? 'A verificar...' : 'Verificar pagamento'}</button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-mono font-medium text-foreground whitespace-nowrap">
                        {f?.valor ? formatCurrency(f.valor) : '-'}
                        {f?.impostos ? <div className="text-xs text-muted-foreground">IVA: {formatCurrency(f.impostos)}</div> : null}
                        {f?.formaPagamento && <div className="text-xs text-muted-foreground">{FORMAS_PAGAMENTO[f.formaPagamento] || f.formaPagamento}</div>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap w-[210px] min-w-[210px]">
                        <div className="flex justify-end gap-1 flex-nowrap">
                          <button onClick={() => handleEdit(f)} className="p-1.5 rounded-md hover:bg-muted flex-shrink-0" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          {f?.cloudStoragePath && (
                            <>
                              <button onClick={() => handleView(f.id, f.contentType)} className="p-1.5 rounded-md hover:bg-muted flex-shrink-0" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                              {f?.versoPath && <button onClick={() => handleView(f.id, f.versoContentType || f.contentType, true)} className="p-1.5 rounded-md hover:bg-muted flex-shrink-0" title="Ver Verso"><RotateCcw className="h-3.5 w-3.5" /></button>}
                              {f?.comprovativoPath && <button onClick={() => handleView(f.id, f.comprovativoContentType || 'application/pdf', false, true)} className="p-1.5 rounded-md hover:bg-muted flex-shrink-0 text-emerald-600" title="Ver Comprovativo de Pagamento"><Receipt className="h-3.5 w-3.5" /></button>}
                              <button onClick={() => handleDownload(f.id)} className="p-1.5 rounded-md hover:bg-muted flex-shrink-0" title="Descarregar"><Download className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                          <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-md hover:bg-destructive/10 flex-shrink-0" title="Eliminar"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>{filtered.length} de {faturas.length} documentos</span>
              {isClientesView && (() => { const anuladas = filtered.filter((f: any) => isAnulada(f)).length; const pagos = filtered.filter((f: any) => isPagamentoValidado(f)).length; const porValidar = filtered.length - pagos - anuladas; return <span>· <span className="text-green-600 font-medium">{pagos} validad{pagos === 1 ? 'a' : 'as'}</span> · <span className="text-yellow-600 font-medium">{porValidar} por validar</span>{anuladas > 0 ? <> · <span className="text-red-600 font-medium">{anuladas} anulad{anuladas === 1 ? 'a' : 'as'}</span></> : null}</span>; })()}
            </div>
          </div>
        </>
      )}

      {/* Scan Modal */}
      <AnimatePresence>
        {showScanModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowScanModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Camera className="h-5 w-5 text-amber-600" />Digitalizar Fatura</h2>
                <button onClick={() => setShowScanModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              {!scanFile ? (
                <div>
                  <div onClick={() => scanFileRef?.current?.click?.()} className="border-2 border-dashed border-amber-300 rounded-xl p-10 text-center cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                    <Camera className="h-12 w-12 mx-auto text-amber-500 mb-3" />
                    <p className="text-base font-medium text-foreground">Tire uma foto ou selecione uma imagem</p>
                    <p className="text-sm text-muted-foreground mt-1">A IA irá extrair automaticamente os dados da fatura</p>
                    <p className="text-xs text-muted-foreground mt-2">JPEG, PNG, PDF (máx. 100MB)</p>
                  </div>
                  <input ref={scanFileRef} type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) handleScanFile(f); }} className="hidden" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview & scan status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {scanPreview && scanFile?.type?.startsWith('image/') ? (
                        <img src={scanPreview} alt="Fatura" className="w-full rounded-lg border" />
                      ) : (
                        <div className="bg-muted rounded-lg p-8 text-center">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">{scanFile?.name}</p>
                        </div>
                      )}
                      <button onClick={() => { setScanFile(null); setScanResult(null); setScanPreview(null); scanFileRef?.current?.click?.(); }} className="mt-2 text-sm text-amber-600 hover:underline">Escolher outro ficheiro</button>
                    </div>

                    <div>
                      {scanning ? (
                        <div className="flex flex-col items-center justify-center h-full py-8">
                          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-3" />
                          <p className="text-sm font-medium">A analisar documento...</p>
                          <p className="text-xs text-muted-foreground">A IA está a extrair os dados</p>
                        </div>
                      ) : scanResult ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-600 mb-2">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium text-sm">Dados extraídos</span>
                          </div>
                          {scanResult.fornecedor && (
                            <div className="bg-muted/50 rounded-lg p-2">
                              <p className="text-xs text-muted-foreground">Fornecedor</p>
                              <p className="text-sm font-medium">{scanResult.fornecedor}</p>
                              {scanResult.nif && <p className="text-xs text-muted-foreground">NIF: {scanResult.nif}</p>}
                            </div>
                          )}
                          {scanResult.valor && (
                            <div className="bg-muted/50 rounded-lg p-2">
                              <p className="text-xs text-muted-foreground">Valor Total</p>
                              <p className="text-sm font-bold">{formatCurrency(scanResult.valor)}</p>
                              {scanResult.valorBase && <p className="text-xs text-muted-foreground">Base: {formatCurrency(scanResult.valorBase)} | IVA: {formatCurrency(scanResult.iva || 0)}</p>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-8">
                          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Sem dados extraídos</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Editable form with scanned data */}
                  {!scanning && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Confirmar e editar dados</h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium mb-1">Número</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                          <div><label className="block text-xs font-medium mb-1">Valor (€)</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                        </div>
                        <div><label className="block text-xs font-medium mb-1">Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium mb-1">Data Emissão</label><input type="date" value={form.dataEmissao} onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                          <div><label className="block text-xs font-medium mb-1">Data Vencimento</label><input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                        </div>
                        <div><label className="block text-xs font-medium mb-1">Fornecedor</label><select value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem fornecedor</option>{(fornecedores ?? []).map((f: any) => <option key={f?.id} value={f?.id}>{f?.nome}{f?.nif ? ` (${f.nif})` : ''}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium mb-1">Forma de Pagamento</label><select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Não definida</option>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                          <div><label className="block text-xs font-medium mb-1">Categoria</label><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                        </div>
                        {/* Verso da Fatura */}
                    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Verso da Fatura (opcional)</span>
                      </div>
                      {versoScanFile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground truncate flex-1">{versoScanFile.name}</span>
                          <button type="button" onClick={() => setVersoScanFile(null)} className="text-xs text-red-500 hover:underline">Remover</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => versoScanRef?.current?.click?.()} className="text-xs text-amber-600 hover:underline">Tirar foto do verso</button>
                      )}
                      <input ref={versoScanRef} type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) { compressImage(f).then(c => setVersoScanFile(c)); } }} className="hidden" />
                    </div>
                    {/* Comprovativo de Pagamento */}
                    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Comprovativo de Pagamento (opcional)</span>
                      </div>
                      {comprovativoScanFile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground truncate flex-1">{comprovativoScanFile.name}</span>
                          <button type="button" onClick={() => setComprovativoScanFile(null)} className="text-xs text-red-500 hover:underline">Remover</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => comprovativoScanRef?.current?.click?.()} className="text-xs text-emerald-600 hover:underline">Anexar comprovativo</button>
                      )}
                      <input ref={comprovativoScanRef} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) { setComprovativoScanFile(f); } }} className="hidden" />
                    </div>

                    <button onClick={handleSaveScan} disabled={uploading} className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2">
                          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />A guardar...</> : <><CheckCircle2 className="h-4 w-4" />Guardar Fatura</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetUploadState()}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Carregar Documento</h2><button onClick={() => resetUploadState()} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleUpload} className="space-y-4">
              {pdfSplitting && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"><Loader2 className="h-4 w-4 animate-spin" />A analisar o PDF e a separar as páginas...</div>
              )}
              {pdfBatch.length > 1 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-800">Fatura {pdfBatchIndex + 1} de {pdfBatch.length}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => goToPage(pdfBatchIndex - 1)} disabled={pdfBatchIndex === 0} title="Página anterior" className="p-1 rounded-md bg-white border border-emerald-300 text-emerald-700 disabled:opacity-40 hover:bg-emerald-100"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" onClick={() => goToPage(pdfBatchIndex + 1)} disabled={pdfBatchIndex === pdfBatch.length - 1} title="Página seguinte" className="p-1 rounded-md bg-white border border-emerald-300 text-emerald-700 disabled:opacity-40 hover:bg-emerald-100"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pdfBatch.map((_, i) => (
                      <button type="button" key={i} onClick={() => goToPage(i)} title={`Ir para a fatura ${i + 1}`} className={`h-6 min-w-[1.5rem] px-1 rounded text-xs font-medium transition-colors ${i === pdfBatchIndex ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>{i + 1}</button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-700">Use as setas ou os números para navegar entre as páginas — os dados de cada fatura ficam guardados enquanto navega. No fim, clique em “Guardar todas”.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Ficheiro *</label>
                <div onClick={() => { if (pdfBatch.length <= 1) fileRef?.current?.click?.(); }} className={`border-2 border-dashed border-input rounded-xl p-6 text-center transition-colors ${pdfBatch.length > 1 ? 'opacity-80' : 'cursor-pointer hover:bg-muted/50'}`}>
                  {uploadOcrLoading ? (
                    <><Loader2 className="h-8 w-8 mx-auto text-amber-500 mb-2 animate-spin" /><p className="text-sm font-medium">A ler documento...</p><p className="text-xs text-muted-foreground mt-1">Extraindo dados automaticamente</p></>
                  ) : (
                    <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste um ficheiro'}</p>
                    {uploadOcrDone && <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Dados extraídos automaticamente</p>}
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG (máx. 100MB)</p></>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={(e) => handleUploadFileSelect(e?.target?.files?.[0] ?? null)} className="hidden" />
                {selectedFile && selectedFilePreview && (
                  <div className="mt-3 rounded-xl border border-input overflow-hidden bg-muted/30">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-input bg-muted/50">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{pdfBatch.length > 1 ? `Pré-visualização — página ${pdfBatchIndex + 1} de ${pdfBatch.length}` : 'Pré-visualização do documento'}</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => { setPreviewUrl(selectedFilePreview); setPreviewType(selectedFile.type); }} className="text-xs text-primary hover:underline flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />Abrir em grande</button>
                        <a href={selectedFilePreview} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Nova aba</a>
                      </div>
                    </div>
                    {selectedFile.type === 'application/pdf' ? (
                      <iframe src={selectedFilePreview} title="Pré-visualização do documento" className="w-full h-64 bg-white" />
                    ) : (
                      <div className="max-h-64 overflow-auto flex items-center justify-center p-2 bg-white">
                        <img src={selectedFilePreview} alt="Pré-visualização do documento" className="max-w-full h-auto rounded" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Número</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Tipo</label><select value={isNotaTipo(form.tipo) ? 'nota' : form.tipo} onChange={(e) => { const v = e.target.value; setForm({ ...form, tipo: v === 'nota' ? 'nota_credito' : v }); }} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{tipoOptions.map((t: any) => <option key={t.valor} value={t.valor}>{t.label}</option>)}</select></div>
              </div>
              {isNotaTipo(form.tipo) && (
                <div><label className="block text-sm font-medium mb-1">Tipo de Nota</label><div className="flex gap-2"><button type="button" onClick={() => setForm({ ...form, tipo: 'nota_credito' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.tipo !== 'nota_debito' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Crédito</button><button type="button" onClick={() => setForm({ ...form, tipo: 'nota_debito' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.tipo === 'nota_debito' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Débito</button></div></div>
              )}
              {isNotaTipo(form.tipo) && (
                <div><label className="block text-sm font-medium mb-1">Fatura relacionada</label>
                  <select value={form.faturaRelacionadaId} onChange={(e) => setForm({ ...form, faturaRelacionadaId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">
                    <option value="">Sem fatura associada</option>
                    {(faturas ?? []).filter((ff: any) => !isNotaTipo(ff?.tipo) && (form.fornecedorId ? ff?.fornecedorId === form.fornecedorId : true) && (form.clienteId ? ff?.clienteId === form.clienteId : true)).map((ff: any) => <option key={ff?.id} value={ff?.id}>{ff?.numero || 'S/ número'}{ff?.fornecedor?.nome || ff?.cliente?.nome || ff?.entidadeNome ? ` — ${ff?.fornecedor?.nome || ff?.cliente?.nome || ff?.entidadeNome}` : ''}{ff?.valor ? ` (${ff.valor}€)` : ''}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Ligue esta nota à fatura que credita/debita.</p>
                </div>
              )}
              <div><label className="block text-sm font-medium mb-1">Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div><label className="block text-sm font-medium mb-1">Valor (€)</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Data Emissão</label><input type="date" value={form.dataEmissao} onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Data Vencimento</label><input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Cliente</label><select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem cliente</option>{(clientes ?? []).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Fornecedor</label><select value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem fornecedor</option>{(fornecedores ?? []).map((f: any) => <option key={f?.id} value={f?.id}>{f?.nome}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Categoria</label><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Forma de Pagamento</label><select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Não definida</option>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              {/* Verso */}
              {pdfBatch.length <= 1 && (
              <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><RotateCcw className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Verso da Fatura (opcional)</span></div>
                {versoUploadFile ? (
                  <div className="flex items-center gap-2"><span className="text-xs text-foreground truncate flex-1">{versoUploadFile.name}</span><button type="button" onClick={() => setVersoUploadFile(null)} className="text-xs text-red-500 hover:underline">Remover</button></div>
                ) : (
                  <button type="button" onClick={() => versoUploadRef?.current?.click?.()} className="text-xs text-primary hover:underline">Adicionar verso</button>
                )}
                <input ref={versoUploadRef} type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) { compressImage(f).then(c => setVersoUploadFile(c)); } }} className="hidden" />
              </div>
              )}
              {/* Comprovativo de Pagamento */}
              {pdfBatch.length <= 1 && (
              <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><Receipt className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Comprovativo de Pagamento (opcional)</span></div>
                {comprovativoUploadFile ? (
                  <div className="flex items-center gap-2"><span className="text-xs text-foreground truncate flex-1">{comprovativoUploadFile.name}</span><button type="button" onClick={() => setComprovativoUploadFile(null)} className="text-xs text-red-500 hover:underline">Remover</button></div>
                ) : (
                  <button type="button" onClick={() => comprovativoUploadRef?.current?.click?.()} className="text-xs text-emerald-600 hover:underline">Anexar comprovativo</button>
                )}
                <input ref={comprovativoUploadRef} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) { setComprovativoUploadFile(f); } }} className="hidden" />
              </div>
              )}
              <button type="submit" disabled={uploading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60">{uploading ? 'A guardar...' : (pdfBatch.length > 1 ? `Guardar todas as ${pdfBatch.length} faturas` : 'Carregar Documento')}</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {editingFatura && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingFatura(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Editar Fatura</h2><button onClick={() => setEditingFatura(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Número</label><input value={editForm.numero} onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Tipo</label><select value={isNotaTipo(editForm.tipo) ? 'nota' : editForm.tipo} onChange={(e) => { const v = e.target.value; setEditForm({ ...editForm, tipo: v === 'nota' ? 'nota_credito' : v }); }} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{tipoOptions.map((t: any) => <option key={t.valor} value={t.valor}>{t.label}</option>)}</select></div>
              </div>
              {isNotaTipo(editForm.tipo) && (
                <div><label className="block text-sm font-medium mb-1">Tipo de Nota</label><div className="flex gap-2"><button type="button" onClick={() => setEditForm({ ...editForm, tipo: 'nota_credito' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${editForm.tipo !== 'nota_debito' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Crédito</button><button type="button" onClick={() => setEditForm({ ...editForm, tipo: 'nota_debito' })} className={`flex-1 py-2 rounded-lg text-sm font-medium ${editForm.tipo === 'nota_debito' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Débito</button></div></div>
              )}
              {isNotaTipo(editForm.tipo) && (
                <div><label className="block text-sm font-medium mb-1">Fatura relacionada</label>
                  <select value={editForm.faturaRelacionadaId} onChange={(e) => setEditForm({ ...editForm, faturaRelacionadaId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">
                    <option value="">Sem fatura associada</option>
                    {(faturas ?? []).filter((ff: any) => !isNotaTipo(ff?.tipo) && ff?.id !== editingFatura?.id && (editForm.fornecedorId ? ff?.fornecedorId === editForm.fornecedorId : true) && (editForm.clienteId ? ff?.clienteId === editForm.clienteId : true)).map((ff: any) => <option key={ff?.id} value={ff?.id}>{ff?.numero || 'S/ número'}{ff?.fornecedor?.nome || ff?.cliente?.nome || ff?.entidadeNome ? ` — ${ff?.fornecedor?.nome || ff?.cliente?.nome || ff?.entidadeNome}` : ''}{ff?.valor ? ` (${ff.valor}€)` : ''}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Ligue esta nota à fatura que credita/debita.</p>
                </div>
              )}
              <div><label className="block text-sm font-medium mb-1">Descrição</label><input value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div><label className="block text-sm font-medium mb-1">Referência</label><input value={editForm.referencia} onChange={(e) => setEditForm({ ...editForm, referencia: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium mb-1">Valor (€)</label><input type="number" step="0.01" value={editForm.valor} onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Valor Bruto (€)</label><input type="number" step="0.01" value={editForm.valorBruto} onChange={(e) => setEditForm({ ...editForm, valorBruto: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Impostos (€)</label><input type="number" step="0.01" value={editForm.impostos} onChange={(e) => setEditForm({ ...editForm, impostos: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Data Emissão</label><input type="date" value={editForm.dataEmissao} onChange={(e) => setEditForm({ ...editForm, dataEmissao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Data Vencimento</label><input type="date" value={editForm.dataVencimento} onChange={(e) => setEditForm({ ...editForm, dataVencimento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Entidade Nome</label><input value={editForm.entidadeNome} onChange={(e) => setEditForm({ ...editForm, entidadeNome: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
                <div><label className="block text-sm font-medium mb-1">Entidade NIF</label><input value={editForm.entidadeNif} onChange={(e) => setEditForm({ ...editForm, entidadeNif: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Cliente</label><select value={editForm.clienteId} onChange={(e) => setEditForm({ ...editForm, clienteId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem cliente</option>{(clientes ?? []).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Fornecedor</label><select value={editForm.fornecedorId} onChange={(e) => setEditForm({ ...editForm, fornecedorId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Sem fornecedor</option>{(fornecedores ?? []).map((f: any) => <option key={f?.id} value={f?.id}>{f?.nome}{f?.nif ? ` (${f.nif})` : ''}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Categoria</label><select value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">{Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Forma de Pagamento</label><select value={editForm.formaPagamento} onChange={(e) => setEditForm({ ...editForm, formaPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="">Não definida</option>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              {/* Comprovativo de Pagamento */}
              <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><Receipt className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Comprovativo de Pagamento (opcional)</span></div>
                {comprovativoEditFile ? (
                  <div className="flex items-center gap-2"><span className="text-xs text-foreground truncate flex-1">{comprovativoEditFile.name}</span><button type="button" onClick={() => setComprovativoEditFile(null)} className="text-xs text-red-500 hover:underline">Remover</button></div>
                ) : editingFatura?.comprovativoPath ? (
                  <div className="flex items-center gap-2"><span className="text-xs text-emerald-600 truncate flex-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{editingFatura?.comprovativoOriginal || 'Comprovativo anexado'}</span><button type="button" onClick={() => comprovativoEditRef?.current?.click?.()} className="text-xs text-primary hover:underline">Substituir</button></div>
                ) : (
                  <button type="button" onClick={() => comprovativoEditRef?.current?.click?.()} className="text-xs text-emerald-600 hover:underline">Anexar comprovativo</button>
                )}
                <input ref={comprovativoEditRef} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e?.target?.files?.[0]; if (f) { setComprovativoEditFile(f); } }} className="hidden" />
              </div>
              <button onClick={handleSaveEdit} disabled={editSaving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {editSaving ? <><Loader2 className="h-4 w-4 animate-spin" />A guardar...</> : <><CheckCircle2 className="h-4 w-4" />Guardar Alterações</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => { setPreviewUrl(null); setPreviewType(''); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b"><h2 className="font-semibold">Pré-visualização</h2><div className="flex items-center gap-2"><a href={previewUrl} download className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" />Descarregar</a><button onClick={() => { const w = window.open(previewUrl, '_blank'); if (w) { w.onload = () => w.print(); } }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-muted hover:bg-muted/80"><Printer className="h-4 w-4" />Imprimir</button><button onClick={() => { setPreviewUrl(null); setPreviewType(''); }} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              <FilePreviewFrame url={previewUrl} contentType={previewType} className="w-full h-[70vh] rounded-lg" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Gerir Categorias Modal */}
      <AnimatePresence>
        {showCategoriasModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCategoriasModal(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Tag className="h-5 w-5" />Gerir Categorias</h3>
                <button onClick={() => setShowCategoriasModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              {/* Add/Edit form */}
              <div className="flex gap-2 mb-4">
                <input value={catForm.nome} onChange={e => setCatForm({...catForm, nome: e.target.value})} placeholder="Nome da categoria" className="input flex-1" />
                <input value={catForm.cor} onChange={e => setCatForm({...catForm, cor: e.target.value})} placeholder="Cor (opcional)" className="input w-32" />
                <button onClick={handleSaveCat} disabled={catSaving} className="btn-primary px-4 flex items-center gap-1">
                  {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCat ? <><Pencil className="h-3.5 w-3.5" />Editar</> : <><Plus className="h-3.5 w-3.5" />Adicionar</>}
                </button>
                {editingCat && <button onClick={() => { setEditingCat(null); setCatForm({ nome: '', cor: '' }); }} className="btn-secondary px-3">Cancelar</button>}
              </div>

              {/* List */}
              <div className="space-y-1">
                {categorias.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sem categorias</p> : categorias.map((cat: any, i: number) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cat.cor || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}`}>{cat.nome}</span>
                      <span className="text-xs text-muted-foreground">({cat.slug})</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingCat(cat); setCatForm({ nome: cat.nome, cor: cat.cor || '' }); }} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Crop Modal */}
      {cropImage && (
        <ImageCropModal
          imageSrc={cropImage.src}
          onConfirm={cropImage.callback}
          onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }}
        />
      )}

      {/* Modal MB WAY */}
      <AnimatePresence>
        {mbwayModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!mbwayEnviando) setMbwayModal(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Smartphone className="h-5 w-5 text-rose-600" />Pagar com MB WAY</h2>
                <button onClick={() => setMbwayModal(null)} disabled={mbwayEnviando} className="p-1 rounded hover:bg-muted disabled:opacity-50"><X className="h-5 w-5" /></button>
              </div>
              <div className="mb-4 text-sm text-muted-foreground border-b border-border pb-3">
                <div className="font-medium text-foreground">{mbwayModal?.numero || mbwayModal?.nomeOriginal || '-'}</div>
                <div>{mbwayModal?.entidadeNome || mbwayModal?.cliente?.nome || ''}</div>
                {mbwayModal?.valor ? <div className="font-mono text-base text-foreground">{formatCurrency(mbwayModal.valor)}</div> : null}
              </div>
              <label className="block text-sm font-medium mb-1">Telemóvel do cliente</label>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                value={mbwayTel}
                onChange={(e: any) => setMbwayTel(e.target.value)}
                onKeyDown={(e: any) => { if (e.key === 'Enter' && !mbwayEnviando) enviarMBWay(); }}
                placeholder="ex: 912345678"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
              <p className="mt-2 text-xs text-muted-foreground">Será enviado um pedido de pagamento para a app MB WAY do cliente. Assim que confirmado, a fatura é marcada como paga e o comprovativo é gerado automaticamente.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setMbwayModal(null)} disabled={mbwayEnviando} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50">Cancelar</button>
                <button onClick={enviarMBWay} disabled={mbwayEnviando} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-2">{mbwayEnviando ? 'A enviar...' : (<><Smartphone className="h-4 w-4" />Enviar pedido</>)}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal de validação de pagamento */}
      <AnimatePresence>
        {validandoFatura && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setValidandoFatura(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Validar Pagamento</h2>
                <button onClick={() => setValidandoFatura(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>
              <div className="mb-4 text-sm text-muted-foreground border-b border-border pb-3">
                <div className="font-medium text-foreground">{validandoFatura?.numero || validandoFatura?.nomeOriginal || '-'}</div>
                <div>{validandoFatura?.entidadeNome || validandoFatura?.cliente?.nome || ''}</div>
                {validandoFatura?.valor ? <div className="font-mono text-base text-foreground">{formatCurrency(validandoFatura.valor)}</div> : null}
              </div>

              {!modoManual ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium"><Landmark className="h-4 w-4 text-primary" />Movimentos bancários compatíveis</div>
                  <p className="text-xs text-muted-foreground -mt-1">Selecione o movimento correspondente ao recebimento. Ao conciliar, a fatura fica automaticamente validada como paga.</p>
                  {(() => {
                    const sugestoes = sugestoesMovimentos(validandoFatura);
                    if (sugestoes.length === 0) {
                      return (
                        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                          Não há movimentos bancários por reconciliar. Importe o extrato bancário ou registe o pagamento manualmente.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {sugestoes.map((m: any, i: number) => (
                          <div key={m?.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${m.__valorMatch ? 'border-green-300 bg-green-50/60 dark:border-green-800 dark:bg-green-900/10' : 'border-border'}`}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded font-medium">Melhor sugestão</span>}
                                {m.__valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded font-medium">Valor coincide</span>}
                              </div>
                              <p className="text-sm truncate text-foreground">{m?.descricao || 'Movimento'}</p>
                              <p className="text-[11px] text-muted-foreground">{formatDate(m?.dataMovimento)}{m?.contaBancaria?.nome ? ` · ${m.contaBancaria.nome}` : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">+{formatCurrency(m?.valor)}</p>
                              <button onClick={() => conciliarComMovimento(m?.id)} disabled={!!reconciliandoMov} className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60">{reconciliandoMov === m?.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}Conciliar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="pt-2 text-center">
                    <button onClick={() => setModoManual(true)} className="text-xs text-primary hover:underline font-medium">Nenhum destes — registar pagamento manualmente</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Forma de Pagamento <span className="text-destructive">*</span></label>
                    <select value={validForm.formaPagamento} onChange={(e) => setValidForm({ ...validForm, formaPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground">
                      <option value="">Selecione...</option>
                      {Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Data de Pagamento <span className="text-destructive">*</span></label>
                    <input type="date" value={validForm.dataPagamento} onChange={(e) => setValidForm({ ...validForm, dataPagamento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Use esta opção quando o recebimento não corresponde a um movimento bancário importado (ex.: numerário).</p>
                  <button onClick={() => setModoManual(false)} className="text-xs text-primary hover:underline font-medium">← Voltar aos movimentos bancários</button>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button onClick={() => setValidandoFatura(null)} className="flex-1 px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                {modoManual && (
                  <button onClick={confirmarValidacao} disabled={validSaving} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">{validSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Validar Pagamento</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}