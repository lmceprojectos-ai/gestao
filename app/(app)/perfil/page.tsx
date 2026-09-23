'use client';

import { useEffect, useState, useRef } from 'react';
import { UserCircle, Loader2, Save, ShieldCheck, Briefcase, IdCard, Camera, Trash2, Eye, X, Download, CheckCircle2, ArrowRight, Upload } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';
import { CameraCaptureModal } from '@/components/camera-capture-modal';
import { FilePreviewFrame } from '@/components/file-preview-frame';

function toDateInput(d: any) { if (!d) return ''; try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; } }

// Rácio de um cartão real (formato ID-1: 85,6 × 53,98 mm).
const CARD_ASPECT = 85.6 / 53.98;

const ID_DOCS: { tipo: string; label: string }[] = [
  { tipo: 'cartao_cidadao', label: 'Cartão de Cidadão' },
  { tipo: 'carta_conducao', label: 'Carta de Condução' },
];
const LADO_LABEL: Record<string, string> = { frente: 'Frente', verso: 'Verso' };

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [funcionarios, setFuncionarios] = useState<string[]>([]);
  const [form, setForm] = useState({ nomeCompleto: '', numero: '', email: '', morada: '', dataNascimento: '', funcionarioVencimento: '' });

  // Documentos de identificação
  const [docsId, setDocsId] = useState<any[]>([]);
  const [capture, setCapture] = useState<{ tipo: string; lado: string } | null>(null);
  const [pendingVerso, setPendingVerso] = useState<string | null>(null); // tipo cujo verso falta
  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const idFileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<{ tipo: string; lado: string } | null>(null);
  // Menu para escolher entre câmara e ficheiro/galeria
  const [chooser, setChooser] = useState<{ tipo: string; lado: string } | null>(null);
  // Câmara ao vivo com moldura do cartão
  const [cameraOpen, setCameraOpen] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/perfil'); const d = await r.json();
      setFuncionarios(d.funcionarios || []);
      if (d.perfil) {
        setForm({
          nomeCompleto: d.perfil.nomeCompleto || '',
          numero: d.perfil.numero || '',
          email: d.perfil.email || '',
          morada: d.perfil.morada || '',
          dataNascimento: toDateInput(d.perfil.dataNascimento),
          funcionarioVencimento: d.perfil.funcionarioVencimento || '',
        });
      }
    } catch {} finally { setLoading(false); }
  };
  const loadDocs = async () => {
    try { const r = await fetch('/api/perfil/documentos'); const d = await r.json(); setDocsId(Array.isArray(d) ? d : []); } catch {}
  };
  useEffect(() => { load(); loadDocs(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error();
      toast.success('Perfil guardado');
    } catch { toast.error('Erro ao guardar o perfil'); } finally { setSaving(false); }
  };

  const getDoc = (tipo: string, lado: string) => docsId.find(d => d.tipo === tipo && d.lado === lado);

  // Abre o menu de escolha (câmara ou ficheiro/galeria) para um lado específico.
  const startCapture = (tipo: string, lado: string) => {
    captureRef.current = { tipo, lado };
    setCapture({ tipo, lado });
    setChooser({ tipo, lado });
  };

  // Aciona a fonte escolhida. Para ficheiro, o click() tem de ser SÍNCRONO dentro
  // do gesto do utilizador (Safari/iOS). Para câmara, abre a câmara ao vivo com moldura.
  const pickSource = (source: 'camera' | 'ficheiro') => {
    setChooser(null);
    if (source === 'camera') setCameraOpen(true);
    else idFileRef.current?.click();
  };

  // Recebe a foto já recortada à moldura do cartão e guarda-a.
  const onCameraCapture = (blob: Blob) => {
    setCameraOpen(false);
    const cap = captureRef.current;
    if (!cap) return;
    const name = `${cap.tipo}-${cap.lado}-${Date.now()}.jpg`;
    const file = new File([blob], name, { type: 'image/jpeg' });
    saveIdDoc(file);
  };

  const onIdFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    e.target.value = '';
    const cap = captureRef.current;
    if (!raw || !cap) return;
    const file = await compressImage(raw);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); saveIdDoc(c); } });
    } else {
      saveIdDoc(file);
    }
  };

  const saveIdDoc = async (file: File) => {
    const cap = captureRef.current;
    if (!cap) return;
    const { tipo, lado } = cap;
    setUploadingId(true);
    try {
      const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }) });
      const pres = await presRes.json();
      await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      const r = await fetch('/api/perfil/documentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, lado, cloudStoragePath: pres.cloud_storage_path, contentType: file.type, nomeOriginal: file.name }) });
      if (!r.ok) throw new Error();
      await loadDocs();
      const label = ID_DOCS.find(d => d.tipo === tipo)?.label || 'Documento';
      if (lado === 'frente' && !getDoc(tipo, 'verso')) {
        setPendingVerso(tipo);
        toast.success(`Frente do ${label} guardada. Agora fotografe o verso.`);
      } else {
        setPendingVerso(null);
        toast.success(`${LADO_LABEL[lado]} do ${label} guardada.`);
      }
    } catch { toast.error('Erro ao guardar o documento'); } finally { setUploadingId(false); setCapture(null); captureRef.current = null; }
  };

  const deleteIdDoc = async (id: string) => {
    if (!confirm('Eliminar esta imagem?')) return;
    try { await fetch(`/api/perfil/documentos/${id}`, { method: 'DELETE' }); await loadDocs(); toast.success('Eliminado'); } catch { toast.error('Erro ao eliminar'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="O Meu Perfil" description="Os seus dados pessoais e documentos" icon={UserCircle} />

      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <p><span className="font-semibold">Dados privados.</span> Apenas você vê e edita o seu perfil e os seus documentos. Nem os administradores têm acesso.</p>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
        <div className="card p-6 max-w-2xl space-y-4">
          <div><label className="label">Nome completo</label><input value={form.nomeCompleto} onChange={e => setForm({...form, nomeCompleto: e.target.value})} className="input w-full" placeholder="O seu nome completo" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Número</label><input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} className="input w-full" placeholder="Telefone / contacto" /></div>
            <div><label className="label">Data de nascimento</label><input type="date" value={form.dataNascimento} onChange={e => setForm({...form, dataNascimento: e.target.value})} className="input w-full" /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input w-full" placeholder="email@exemplo.pt" /></div>
          <div><label className="label">Morada</label><textarea value={form.morada} onChange={e => setForm({...form, morada: e.target.value})} className="input w-full" rows={2} placeholder="Morada completa" /></div>
          <div>
            <label className="label flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Funcionário associado (vencimentos)</label>
            <select value={form.funcionarioVencimento} onChange={e => setForm({...form, funcionarioVencimento: e.target.value})} className="input w-full">
              <option value="">— Selecione o seu registo nos vencimentos —</option>
              {funcionarios.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Isto liga o seu perfil aos seus recibos de vencimento, para gerar a checklist de documentos do IRS.</p>
          </div>
          <div className="flex justify-end pt-2"><button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar</button></div>
        </div>
      )}

      {/* Documentos de identificação */}
      <div className="max-w-2xl space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-lg"><IdCard className="h-5 w-5 text-primary" />Documentos de identificação</h3>
          <p className="text-sm text-muted-foreground">Fotografe a frente e o verso. A imagem é enquadrada automaticamente no formato do cartão.</p>
        </div>

        {ID_DOCS.map(({ tipo, label }) => (
          <div key={tipo} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2"><IdCard className="h-4 w-4 text-muted-foreground" />{label}</h4>
              {getDoc(tipo, 'frente') && getDoc(tipo, 'verso') && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Completo</span>
              )}
            </div>

            {pendingVerso === tipo && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="flex items-center gap-2"><ArrowRight className="h-4 w-4" />Falta o <strong>verso</strong> do {label}.</span>
                <button onClick={() => startCapture(tipo, 'verso')} disabled={uploadingId} className="btn-primary text-xs flex items-center gap-1"><Camera className="h-3.5 w-3.5" />Fotografar verso</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {['frente', 'verso'].map((lado) => {
                const doc = getDoc(tipo, lado);
                return (
                  <div key={lado} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{LADO_LABEL[lado]}</p>
                    {doc?.url ? (
                      <div className="relative group rounded-lg overflow-hidden border bg-muted" style={{ aspectRatio: String(CARD_ASPECT) }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={doc.url} alt={`${label} ${lado}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setPreviewUrl(doc.url)} className="p-2 rounded-full bg-white/90 hover:bg-white" title="Ver"><Eye className="h-4 w-4 text-gray-800" /></button>
                          <button onClick={() => startCapture(tipo, lado)} className="p-2 rounded-full bg-white/90 hover:bg-white" title="Substituir"><Camera className="h-4 w-4 text-gray-800" /></button>
                          <button onClick={() => deleteIdDoc(doc.id)} className="p-2 rounded-full bg-white/90 hover:bg-white" title="Eliminar"><Trash2 className="h-4 w-4 text-red-600" /></button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => startCapture(tipo, lado)} disabled={uploadingId} className="w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors" style={{ aspectRatio: String(CARD_ASPECT) }}>
                        {uploadingId && capture?.tipo === tipo && capture?.lado === lado ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                        <span className="text-xs">Fotografar {LADO_LABEL[lado].toLowerCase()}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <input ref={idFileRef} type="file" accept="image/*" className="hidden" onChange={onIdFileSelect} />

      {/* Câmara ao vivo com moldura do cartão */}
      {cameraOpen && (
        <CameraCaptureModal
          aspect={CARD_ASPECT}
          title="Enquadrar o cartão"
          onCapture={onCameraCapture}
          onCancel={() => { setCameraOpen(false); setCapture(null); captureRef.current = null; }}
          onUseFile={() => { setCameraOpen(false); idFileRef.current?.click(); }}
        />
      )}

      {/* Menu de escolha: câmara ou ficheiro/galeria */}
      <AnimatePresence>{chooser && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => { setChooser(null); setCapture(null); captureRef.current = null; }}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="bg-background rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-2">
              <h3 className="font-semibold text-base">Adicionar imagem</h3>
              <p className="text-sm text-muted-foreground">Como pretende adicionar o documento?</p>
            </div>
            <div className="p-3 space-y-2">
              <button onClick={() => pickSource('camera')} className="w-full flex items-center gap-3 rounded-xl border border-input p-3 text-left hover:bg-muted transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Camera className="h-5 w-5" /></span>
                <span><span className="block font-medium text-sm">Usar a câmara</span><span className="block text-xs text-muted-foreground">Tirar uma foto agora</span></span>
              </button>
              <button onClick={() => pickSource('ficheiro')} className="w-full flex items-center gap-3 rounded-xl border border-input p-3 text-left hover:bg-muted transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="h-5 w-5" /></span>
                <span><span className="block font-medium text-sm">Escolher um ficheiro</span><span className="block text-xs text-muted-foreground">Selecionar da galeria ou dispositivo</span></span>
              </button>
            </div>
            <div className="p-3 pt-0"><button onClick={() => { setChooser(null); setCapture(null); captureRef.current = null; }} className="w-full rounded-xl py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>{previewUrl && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}><motion.div initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="bg-background rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b"><h3 className="font-semibold">Documento</h3><div className="flex gap-2"><a href={previewUrl} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-1 text-sm"><Download className="h-4 w-4" />Abrir</a><button onClick={() => setPreviewUrl(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button></div></div>
        <div className="flex-1 overflow-auto p-4"><FilePreviewFrame url={previewUrl} /></div>
      </motion.div></motion.div>}</AnimatePresence>

      {cropImage && <ImageCropModal imageSrc={cropImage.src} aspect={CARD_ASPECT} title="Enquadrar cartão" onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); setCapture(null); captureRef.current = null; }} />}
    </div>
  );
}
