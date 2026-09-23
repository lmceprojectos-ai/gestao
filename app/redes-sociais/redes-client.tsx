'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';
import { compressImage } from '@/lib/compress-image';
import {
  Share2, LayoutGrid, PlusCircle, CalendarDays, ListChecks, Plug, ArrowLeft,
  Facebook, Instagram, Youtube, Music2, Sparkles, ImagePlus, Loader2, Copy, Trash2, Pencil,
  Download, Send, Clock, FileText, Megaphone, X, Check, Wand2, Upload, Video, Film,
  Target, Euro, TrendingUp, MousePointerClick, Eye, Users,
} from 'lucide-react';

type Post = {
  id: string; titulo: string; plataformas: string; tipo: string; formato: string; texto: string | null;
  imagemPath: string | null; imagemUrl: string | null; imagemContentType: string | null;
  videoPath: string | null; videoUrl: string | null; videoContentType: string | null; roteiro: any;
  estado: string; agendadoEm: string | null; publicadoEm: string | null;
  promptTexto: string | null; promptImagem: string | null; referencias: any; notas: string | null;
  conteudoPlataformas: any; briefIa: string | null;
  campanhaId: string | null; criadoPor: string | null; createdAt: string; updatedAt: string;
};

type Campanha = {
  id: string; nome: string; objetivo: string | null; plataformas: string; estado: string;
  orcamento: number | null; gastoAtual: number | null; inicio: string | null; fim: string | null;
  impressoes: number | null; alcance: number | null; cliques: number | null; conversoes: number | null;
  notas: string | null; criadoPor: string | null; createdAt: string; updatedAt: string;
};

type Section = 'painel' | 'criar' | 'agenda' | 'publicacoes' | 'campanhas' | 'ligacoes';

const PLATAFORMAS = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, active: 'border-blue-500 bg-blue-50 text-blue-700' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, active: 'border-pink-500 bg-pink-50 text-pink-700' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, active: 'border-slate-800 bg-slate-100 text-slate-900' },
  { key: 'youtube_shorts', label: 'YouTube Shorts', icon: Youtube, active: 'border-red-500 bg-red-50 text-red-700' },
];

const ESTADO_LABEL: Record<string, string> = { rascunho: 'Rascunho', agendado: 'Agendado', publicado: 'Publicado', cancelado: 'Cancelado' };
const ESTADO_CLASS: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-700', agendado: 'bg-amber-100 text-amber-700',
  publicado: 'bg-emerald-100 text-emerald-700', cancelado: 'bg-rose-100 text-rose-700',
};
const CAMP_ESTADO_LABEL: Record<string, string> = { planeada: 'Planeada', ativa: 'Ativa', pausada: 'Pausada', concluida: 'Concluída' };
const CAMP_ESTADO_CLASS: Record<string, string> = {
  planeada: 'bg-slate-100 text-slate-700', ativa: 'bg-emerald-100 text-emerald-700',
  pausada: 'bg-amber-100 text-amber-700', concluida: 'bg-blue-100 text-blue-700',
};

const EMPTY = {
  id: '', titulo: '', plataformas: ['facebook'] as string[], tipo: 'publicacao', formato: 'imagem',
  tema: '', tom: 'profissional e próximo', detalhes: '', texto: '',
  imagemUrl: '', imagemPath: '', imagemContentType: '', descricaoImagem: '', aspect: '1:1',
  videoUrl: '', videoPath: '', videoContentType: '', roteiro: [] as any[], nCenas: 4, duracaoCena: 3, modoVideoImg: 'diretas',
  agendadoData: '', agendadoHora: '', notas: '', campanhaId: '', referencias: [] as { url: string; path: string }[],
  briefIa: '', conteudoPlataformas: {} as Record<string, any>,
};

const fmtEur = (n: number | null | undefined) => `${(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtNum = (n: number | null | undefined) => (n || 0).toLocaleString('pt-PT');

export default function RedesClient() {
  const [section, setSection] = useState<Section>('painel');
  const [posts, setPosts] = useState<Post[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [rp, rc] = await Promise.all([fetch('/api/redes-sociais/posts'), fetch('/api/redes-sociais/campanhas')]);
      if (rp.ok) setPosts(await rp.json());
      if (rc.ok) setCampanhas(await rc.json());
    } catch {} finally { setLoading(false); }
  };
  const loadCampanhas = async () => { try { const r = await fetch('/api/redes-sociais/campanhas'); if (r.ok) setCampanhas(await r.json()); } catch {} };
  useEffect(() => { load(); }, []);

  // ---- Formulário criar/editar ----
  const [form, setForm] = useState({ ...EMPTY });
  const [genText, setGenText] = useState<{ variacoes: string[]; hashtags: string[]; ideiaImagem: string } | null>(null);
  const [busyText, setBusyText] = useState(false);
  const [busyImg, setBusyImg] = useState(false);
  const [busyVideo, setBusyVideo] = useState(false);
  const [busyTudo, setBusyTudo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  const resetForm = () => { setForm({ ...EMPTY }); setGenText(null); };
  const goCreate = () => { resetForm(); setSection('criar'); };

  const togglePlataforma = (p: string) => setForm(f => ({ ...f, plataformas: f.plataformas.includes(p) ? f.plataformas.filter(x => x !== p) : [...f.plataformas, p] }));

  const gerarTexto = async () => {
    if (!form.tema.trim()) { toast.error('Indique o tema da publicação'); return; }
    setBusyText(true);
    try {
      const r = await fetch('/api/redes-sociais/gerar-texto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: form.tema, tom: form.tom, detalhes: form.detalhes, tipo: form.tipo, plataformas: form.plataformas.join(', ') }),
      });
      const d = await r.json();
      if (!r.ok || !d?.data) throw new Error(d?.error || 'Erro');
      setForm(f => ({ ...f, texto: d.data.texto || '', descricaoImagem: f.descricaoImagem || d.data.ideiaImagem || '' }));
      setGenText({ variacoes: d.data.variacoes || [], hashtags: d.data.hashtags || [], ideiaImagem: d.data.ideiaImagem || '' });
      toast.success('Texto gerado');
    } catch (e: any) { toast.error(e?.message || 'Erro ao gerar o texto'); } finally { setBusyText(false); }
  };

  const gerarImagem = async () => {
    const desc = form.descricaoImagem.trim();
    if (!desc) { toast.error('Descreva a imagem pretendida'); return; }
    setBusyImg(true);
    try {
      const r = await fetch('/api/redes-sociais/gerar-imagem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: desc, aspectRatio: form.aspect }),
      });
      const d = await r.json();
      if (!r.ok || !d?.imagemUrl) throw new Error(d?.error || 'Erro');
      setForm(f => ({ ...f, imagemUrl: d.imagemUrl, imagemPath: d.imagemPath, imagemContentType: d.imagemContentType }));
      toast.success('Imagem gerada');
    } catch (e: any) { toast.error(e?.message || 'Erro ao gerar a imagem'); } finally { setBusyImg(false); }
  };

  const gerarVideo = async () => {
    if (!form.tema.trim()) { toast.error('Indique o tema do vídeo'); return; }
    const imagens = form.referencias.map((x) => x.url).filter(Boolean);
    if (form.modoVideoImg === 'diretas' && imagens.length === 0) {
      toast.error('Carregue pelo menos uma imagem para usar no vídeo, ou escolha a opção “A IA cria as imagens”.');
      return;
    }
    setBusyVideo(true);
    toast.info('A gerar o short com IA. Isto pode demorar 1 a 2 minutos…');
    try {
      const r = await fetch('/api/redes-sociais/gerar-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: form.tema, tom: form.tom, detalhes: form.detalhes, nCenas: form.nCenas, duracaoCena: form.duracaoCena, plataforma: form.plataformas.join(', '), imagens, modoImagens: form.modoVideoImg }),
      });
      const d = await r.json();
      if (!r.ok || !d?.videoUrl) throw new Error(d?.error || 'Erro');
      setForm(f => ({
        ...f, videoUrl: d.videoUrl, videoContentType: d.videoContentType || 'video/mp4', roteiro: d.roteiro || [],
        texto: f.texto || d.legenda || '',
      }));
      setGenText(g => ({ variacoes: g?.variacoes || [], hashtags: d.hashtags || g?.hashtags || [], ideiaImagem: g?.ideiaImagem || '' }));
      toast.success('Short gerado com sucesso');
    } catch (e: any) { toast.error(e?.message || 'Erro ao gerar o vídeo'); } finally { setBusyVideo(false); }
  };

  const gerarTudo = async () => {
    if (!form.briefIa.trim()) { toast.error('Descreva o que pretende para a publicação'); return; }
    if (form.plataformas.length === 0) { toast.error('Escolha pelo menos uma plataforma'); return; }
    setBusyTudo(true);
    try {
      const r = await fetch('/api/redes-sociais/gerar-tudo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: form.briefIa, plataformas: form.plataformas, tipo: form.tipo, formato: form.formato,
          imagens: form.referencias.map((x) => x.url).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d?.data) throw new Error(d?.error || 'Erro');
      setForm(f => ({
        ...f,
        titulo: f.titulo || d.data.titulo || '',
        texto: f.texto || d.data.textoBase || '',
        descricaoImagem: f.descricaoImagem || d.data.ideiaImagem || '',
        conteudoPlataformas: { ...f.conteudoPlataformas, ...(d.data.conteudoPlataformas || {}) },
      }));
      toast.success('Conteúdo gerado para cada plataforma');
    } catch (e: any) { toast.error(e?.message || 'Erro ao gerar o conteúdo'); } finally { setBusyTudo(false); }
  };

  const uploadFile = async (file: File, isPublic = true) => {
    const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic }) });
    const pres = await presRes.json();
    const putRes = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!putRes.ok) throw new Error('upload');
    return pres.cloud_storage_path as string;
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploadingRef(true);
    try {
      for (const raw of files) {
        const file = raw.type.startsWith('image/') ? await compressImage(raw) : raw;
        const path = await uploadFile(file, true);
        const rr = await fetch('/api/redes-sociais/ref-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, contentType: file.type }) });
        const dd = await rr.json();
        setForm(f => ({ ...f, referencias: [...f.referencias, { url: dd.url || '', path }] }));
      }
      toast.success('Exemplo(s) carregado(s)');
    } catch { toast.error('Erro ao carregar exemplo'); } finally { setUploadingRef(false); if (refInput.current) refInput.current.value = ''; }
  };

  const usarComoImagem = (url: string, path: string) => setForm(f => ({ ...f, imagemUrl: url, imagemPath: path, imagemContentType: 'image/jpeg' }));
  const removeRef = (path: string) => setForm(f => ({ ...f, referencias: f.referencias.filter(r => r.path !== path) }));

  const salvar = async (estado: 'rascunho' | 'agendado') => {
    if (!form.titulo.trim()) { toast.error('Dê um título interno à publicação'); return; }
    if (form.plataformas.length === 0) { toast.error('Escolha pelo menos uma plataforma'); return; }
    let agendadoEm: string | null = null;
    if (estado === 'agendado') {
      if (!form.agendadoData || !form.agendadoHora) { toast.error('Defina data e hora para agendar'); return; }
      agendadoEm = new Date(`${form.agendadoData}T${form.agendadoHora}`).toISOString();
    } else if (form.agendadoData && form.agendadoHora) {
      agendadoEm = new Date(`${form.agendadoData}T${form.agendadoHora}`).toISOString();
    }
    setSaving(true);
    try {
      const body = {
        titulo: form.titulo, plataformas: form.plataformas.join(','), tipo: form.tipo, formato: form.formato, texto: form.texto,
        imagemPath: form.imagemPath || null, imagemUrl: form.imagemUrl || null, imagemContentType: form.imagemContentType || null,
        videoPath: form.videoPath || null, videoUrl: form.videoUrl || null, videoContentType: form.videoContentType || null, roteiro: form.roteiro,
        estado, agendadoEm, promptTexto: form.tema, promptImagem: form.descricaoImagem,
        referencias: form.referencias, conteudoPlataformas: form.conteudoPlataformas, briefIa: form.briefIa || null,
        notas: form.notas, campanhaId: form.campanhaId || null,
      };
      const url = form.id ? `/api/redes-sociais/posts/${form.id}` : '/api/redes-sociais/posts';
      const method = form.id ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success(estado === 'agendado' ? 'Publicação agendada' : 'Rascunho guardado');
      resetForm(); await load(); setSection('publicacoes');
    } catch { toast.error('Erro ao guardar'); } finally { setSaving(false); }
  };

  const editar = (p: Post) => {
    const dt = p.agendadoEm ? new Date(p.agendadoEm) : null;
    setForm({
      id: p.id, titulo: p.titulo, plataformas: (p.plataformas || '').split(',').filter(Boolean), tipo: p.tipo || 'publicacao', formato: p.formato || 'imagem',
      tema: p.promptTexto || '', tom: 'profissional e próximo', detalhes: '', texto: p.texto || '',
      imagemUrl: p.imagemUrl || '', imagemPath: p.imagemPath || '', imagemContentType: p.imagemContentType || '',
      descricaoImagem: p.promptImagem || '', aspect: '1:1',
      videoUrl: p.videoUrl || '', videoPath: p.videoPath || '', videoContentType: p.videoContentType || '', roteiro: Array.isArray(p.roteiro) ? p.roteiro : [],
      nCenas: Array.isArray(p.roteiro) && p.roteiro.length ? p.roteiro.length : 4, duracaoCena: 3, modoVideoImg: 'diretas',
      agendadoData: dt ? dt.toISOString().slice(0, 10) : '', agendadoHora: dt ? dt.toTimeString().slice(0, 5) : '',
      notas: p.notas || '', campanhaId: p.campanhaId || '', referencias: Array.isArray(p.referencias) ? p.referencias : [],
      briefIa: p.briefIa || '', conteudoPlataformas: (p.conteudoPlataformas && typeof p.conteudoPlataformas === 'object' && !Array.isArray(p.conteudoPlataformas)) ? p.conteudoPlataformas : {},
    });
    setGenText(null); setSection('criar');
  };

  const eliminar = async (id: string) => { if (!confirm('Eliminar esta publicação?')) return; await fetch(`/api/redes-sociais/posts/${id}`, { method: 'DELETE' }); toast.success('Eliminada'); load(); };
  const marcarPublicado = async (id: string) => { await fetch(`/api/redes-sociais/posts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'publicado', publicadoEm: new Date().toISOString() }) }); toast.success('Marcada como publicada'); load(); };
  const copiarTexto = (t: string | null) => { if (!t) return; navigator.clipboard.writeText(t); toast.success('Texto copiado'); };

  const stats = {
    rascunho: posts.filter(p => p.estado === 'rascunho').length,
    agendado: posts.filter(p => p.estado === 'agendado').length,
    publicado: posts.filter(p => p.estado === 'publicado').length,
  };
  const proximas = posts.filter(p => p.estado === 'agendado' && p.agendadoEm).sort((a, b) => new Date(a.agendadoEm!).getTime() - new Date(b.agendadoEm!).getTime());

  const MENU: { key: Section; label: string; icon: any }[] = [
    { key: 'painel', label: 'Painel', icon: LayoutGrid },
    { key: 'criar', label: 'Criar publicação', icon: PlusCircle },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays },
    { key: 'publicacoes', label: 'Publicações', icon: ListChecks },
    { key: 'campanhas', label: 'Campanhas', icon: Target },
    { key: 'ligacoes', label: 'Ligações', icon: Plug },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/20"><Share2 className="h-5 w-5" /></span>
            <div>
              <h1 className="font-display font-bold tracking-tight leading-tight">Redes Sociais</h1>
              <p className="text-[11px] text-white/70">Publicações, shorts e campanhas</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-2 text-sm font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Voltar à Gestão</span><span className="sm:hidden">Gestão</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 border-r bg-muted/30 p-3 gap-1">
          {MENU.map(m => (
            <button key={m.key} onClick={() => setSection(m.key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${section === m.key ? 'bg-fuchsia-600 text-white shadow-sm' : 'hover:bg-muted text-foreground'}`}>
              <m.icon className="h-4 w-4" />{m.label}
            </button>
          ))}
        </aside>

        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background flex justify-around py-1.5 overflow-x-auto">
          {MENU.map(m => (
            <button key={m.key} onClick={() => setSection(m.key)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] shrink-0 ${section === m.key ? 'text-fuchsia-600' : 'text-muted-foreground'}`}>
              <m.icon className="h-5 w-5" />{m.label.split(' ')[0]}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-[1100px] mx-auto w-full">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-600" /></div>
          ) : (
            <>
              {section === 'painel' && (
                <Painel stats={stats} campanhas={campanhas} proximas={proximas} onNew={goCreate} onEdit={editar} onGoCampanhas={() => setSection('campanhas')} />
              )}

              {section === 'criar' && (
                <CriarForm form={form} setForm={setForm} genText={genText} busyText={busyText} busyImg={busyImg} busyVideo={busyVideo} busyTudo={busyTudo}
                  saving={saving} uploadingRef={uploadingRef} refInput={refInput} onRefUpload={handleRefUpload} campanhas={campanhas}
                  gerarTexto={gerarTexto} gerarImagem={gerarImagem} gerarVideo={gerarVideo} gerarTudo={gerarTudo} togglePlataforma={togglePlataforma}
                  salvar={salvar} usarComoImagem={usarComoImagem} removeRef={removeRef} onCancel={() => { resetForm(); setSection('publicacoes'); }} />
              )}

              {section === 'agenda' && <Agenda posts={posts} onEdit={editar} onNew={goCreate} />}

              {section === 'publicacoes' && (
                <Publicacoes posts={posts} onEdit={editar} onDelete={eliminar} onPublish={marcarPublicado} onCopy={copiarTexto} onNew={goCreate} />
              )}

              {section === 'campanhas' && <Campanhas campanhas={campanhas} posts={posts} reload={loadCampanhas} />}

              {section === 'ligacoes' && <Ligacoes />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Painel({ stats, campanhas, proximas, onNew, onEdit, onGoCampanhas }: any) {
  const ativas = campanhas.filter((c: Campanha) => c.estado === 'ativa');
  const orcamentoTotal = campanhas.reduce((s: number, c: Campanha) => s + (c.orcamento || 0), 0);
  const gastoTotal = campanhas.reduce((s: number, c: Campanha) => s + (c.gastoAtual || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Rascunhos" value={stats.rascunho} color="text-slate-600" />
        <StatCard icon={Clock} label="Agendadas" value={stats.agendado} color="text-amber-600" />
        <StatCard icon={Check} label="Publicadas" value={stats.publicado} color="text-emerald-600" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-fuchsia-600" />Campanhas</h2>
          <button onClick={onGoCampanhas} className="btn-secondary text-sm">Gerir campanhas</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniStat icon={TrendingUp} label="Campanhas ativas" value={String(ativas.length)} />
          <MiniStat icon={Euro} label="Orçamento total" value={fmtEur(orcamentoTotal)} />
          <MiniStat icon={Euro} label="Gasto acumulado" value={fmtEur(gastoTotal)} />
        </div>
        {ativas.length > 0 && (
          <div className="mt-4 space-y-2">
            {ativas.slice(0, 3).map((c: Campanha) => <CampanhaBar key={c.id} c={c} />)}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Próximas publicações agendadas</h2>
          <button onClick={onNew} className="btn-primary flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4" />Nova publicação</button>
        </div>
        {proximas.length === 0 ? <p className="text-sm text-muted-foreground">Sem publicações agendadas. Crie uma nova publicação e defina a data/hora.</p> : (
          <div className="space-y-2">{proximas.slice(0, 6).map((p: Post) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
              <PlatIcons plats={p.plataformas} />
              <div className="flex-1 min-w-0"><div className="font-medium truncate flex items-center gap-2">{p.formato === 'video' && <Film className="h-3.5 w-3.5 text-fuchsia-600" />}{p.titulo}</div><div className="text-xs text-muted-foreground">{formatDateTime(p.agendadoEm)}</div></div>
              <button onClick={() => onEdit(p)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className={`flex items-center justify-center h-11 w-11 rounded-xl bg-muted ${color}`}><Icon className="h-5 w-5" /></span>
      <div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3">
      <span className="flex items-center justify-center h-9 w-9 rounded-lg bg-fuchsia-50 text-fuchsia-600"><Icon className="h-4 w-4" /></span>
      <div><div className="text-lg font-bold leading-tight">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
    </div>
  );
}

function CampanhaBar({ c }: { c: Campanha }) {
  const pct = c.orcamento ? Math.min(100, Math.round(((c.gastoAtual || 0) / c.orcamento) * 100)) : 0;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium truncate">{c.nome}</span>
        <span className="text-xs text-muted-foreground">{fmtEur(c.gastoAtual)} / {fmtEur(c.orcamento)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-fuchsia-500" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function PlatIcons({ plats }: { plats: string }) {
  const list = (plats || '').split(',').filter(Boolean);
  return (
    <div className="flex gap-1">
      {list.includes('facebook') && <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-100 text-blue-600"><Facebook className="h-4 w-4" /></span>}
      {list.includes('instagram') && <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-pink-100 text-pink-600"><Instagram className="h-4 w-4" /></span>}
      {list.includes('tiktok') && <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-200 text-slate-900"><Music2 className="h-4 w-4" /></span>}
      {list.includes('youtube_shorts') && <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-100 text-red-600"><Youtube className="h-4 w-4" /></span>}
    </div>
  );
}

function PlatBox({ icon: Icon, cls, nome, children }: any) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`flex items-center justify-center h-8 w-8 rounded-lg ${cls}`}><Icon className="h-4 w-4" /></span>
        <span className="font-medium text-sm">{nome}</span>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, ta, rows }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      {ta
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows || 3} placeholder={placeholder} className="input w-full" />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input w-full" />}
    </div>
  );
}

function CriarForm(props: any) {
  const { form, setForm, genText, busyText, busyImg, busyVideo, busyTudo, saving, uploadingRef, refInput, onRefUpload, campanhas, gerarTexto, gerarImagem, gerarVideo, gerarTudo, togglePlataforma, salvar, usarComoImagem, removeRef, onCancel } = props;
  const isVideo = form.formato === 'video';
  const setPlat = (plat: string, patch: any) => setForm((f: any) => ({ ...f, conteudoPlataformas: { ...(f.conteudoPlataformas || {}), [plat]: { ...((f.conteudoPlataformas || {})[plat] || {}), ...patch } } }));
  const getPlat = (plat: string) => (form.conteudoPlataformas || {})[plat] || {};
  const asText = (v: any) => Array.isArray(v) ? v.join(' ') : (v || '');
  const asLines = (v: any) => Array.isArray(v) ? v.join('\n') : (v || '');
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{form.id ? 'Editar publicação' : 'Criar publicação'}</h2>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Título interno *</label><input value={form.titulo} onChange={e => setForm((f: any) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Promoção flyers Setembro" className="input w-full" /></div>
          <div><label className="label">Tipo</label><select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className="input w-full"><option value="publicacao">Publicação normal</option><option value="anuncio">Anúncio pago</option></select></div>
        </div>
        <div>
          <label className="label">Formato do conteúdo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm((f: any) => ({ ...f, formato: 'imagem' }))} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${!isVideo ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'hover:bg-muted'}`}><ImagePlus className="h-4 w-4" />Imagem</button>
            <button type="button" onClick={() => setForm((f: any) => ({ ...f, formato: 'video' }))} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${isVideo ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'hover:bg-muted'}`}><Video className="h-4 w-4" />Vídeo / Short</button>
          </div>
        </div>
        <div>
          <label className="label">Plataformas</label>
          <div className="flex flex-wrap gap-2">
            {PLATAFORMAS.map(p => (
              <button key={p.key} type="button" onClick={() => togglePlataforma(p.key)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.plataformas.includes(p.key) ? p.active : 'hover:bg-muted'}`}><p.icon className="h-4 w-4" />{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Campanha (opcional)</label>
          <select value={form.campanhaId} onChange={e => setForm((f: any) => ({ ...f, campanhaId: e.target.value }))} className="input w-full">
            <option value="">— Sem campanha —</option>
            {campanhas.map((c: Campanha) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Assistente IA — gerar tudo a partir de um pedido em texto livre + imagens */}
      <div className="card p-5 space-y-4 border-fuchsia-200 bg-fuchsia-50/40">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">Assistente IA — gerar tudo de uma vez</h3></div>
        <p className="text-sm text-muted-foreground">Explique por palavras suas o que pretende para esta publicação. Se quiser, carregue imagens de exemplo e a IA cria o conteúdo já adaptado a cada rede social escolhida acima.</p>
        <div><label className="label">O que pretende para esta publicação?</label>
          <textarea value={form.briefIa} onChange={e => setForm((f: any) => ({ ...f, briefIa: e.target.value }))} rows={3} placeholder="Ex.: Divulgar a promoção de impressão 3D deste mês, 20% de desconto até dia 30, tom próximo a apelar a pequenas empresas." className="input w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => refInput.current?.click()} disabled={uploadingRef} type="button" className="btn-secondary flex items-center gap-2 text-sm">{uploadingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Carregar imagens</button>
          <button onClick={gerarTudo} disabled={busyTudo} type="button" className="btn-primary flex items-center gap-2 text-sm">{busyTudo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{busyTudo ? 'A gerar conteúdo...' : 'Gerar tudo com IA'}</button>
        </div>
        {form.referencias?.length > 0 && (
          <div className="flex flex-wrap gap-3">{form.referencias.map((r: any) => (
            <div key={r.path} className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
              {r.url && <Image src={r.url} alt="Exemplo enviado" fill className="object-cover" />}
              <button type="button" onClick={() => removeRef(r.path)} className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white"><X className="h-3 w-3" /></button>
            </div>
          ))}</div>
        )}
        <p className="text-[11px] text-muted-foreground">O conteúdo gerado por rede aparece mais abaixo, na secção "Conteúdo por rede social", onde pode rever e editar tudo antes de guardar.</p>
      </div>

      {/* Geração de texto */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">{isVideo ? 'Guião e legenda' : 'Texto da publicação'}</h3></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Tema / objetivo</label><input value={form.tema} onChange={e => setForm((f: any) => ({ ...f, tema: e.target.value }))} placeholder="O que quer promover?" className="input w-full" /></div>
          <div><label className="label">Tom</label><input value={form.tom} onChange={e => setForm((f: any) => ({ ...f, tom: e.target.value }))} placeholder="Ex.: profissional, divertido..." className="input w-full" /></div>
        </div>
        <div><label className="label">Detalhes adicionais (opcional)</label><textarea value={form.detalhes} onChange={e => setForm((f: any) => ({ ...f, detalhes: e.target.value }))} rows={2} placeholder="Preços, datas, condições, etc." className="input w-full" /></div>
        {!isVideo && <button onClick={gerarTexto} disabled={busyText} className="btn-primary flex items-center gap-2 text-sm">{busyText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Gerar texto com IA</button>}
        <div><label className="label">{isVideo ? 'Legenda (editável)' : 'Texto (editável)'}</label><textarea value={form.texto} onChange={e => setForm((f: any) => ({ ...f, texto: e.target.value }))} rows={5} placeholder="O texto gerado aparece aqui — pode editar livremente." className="input w-full" /></div>
        {genText && (
          <div className="space-y-3">
            {genText.hashtags?.length > 0 && (
              <div><div className="text-xs font-medium text-muted-foreground mb-1">Hashtags sugeridas</div><div className="flex flex-wrap gap-1.5">{genText.hashtags.map((h: string, i: number) => <button key={i} onClick={() => setForm((f: any) => ({ ...f, texto: (f.texto + ' ' + h).trim() }))} className="text-xs rounded-full bg-fuchsia-50 text-fuchsia-700 px-2 py-1 hover:bg-fuchsia-100">{h}</button>)}</div></div>
            )}
            {genText.variacoes?.length > 0 && (
              <div><div className="text-xs font-medium text-muted-foreground mb-1">Variantes alternativas (clique para usar)</div><div className="space-y-1.5">{genText.variacoes.map((v: string, i: number) => <button key={i} onClick={() => setForm((f: any) => ({ ...f, texto: v }))} className="block w-full text-left text-sm rounded-lg border p-2 hover:bg-muted">{v}</button>)}</div></div>
            )}
          </div>
        )}
      </div>

      {/* Vídeo / Short */}
      {isVideo && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2"><Video className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">Gerar short com IA</h3></div>
          <p className="text-xs text-muted-foreground">Monta um vídeo vertical (formato 9:16, ideal para Reels, TikTok e YouTube Shorts). Pode usar as suas próprias imagens ou deixar a IA criá-las.</p>

          {/* Imagens a usar no vídeo */}
          <div className="rounded-lg border border-dashed p-4 space-y-3">
            <div className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-fuchsia-600" /><span className="text-sm font-medium">Imagens a usar no vídeo</span></div>
            <p className="text-xs text-muted-foreground">Carregue as fotografias/imagens que quer ver no vídeo (produtos, trabalhos, logótipo…). A ordem de carregamento é a ordem das cenas.</p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="radio" name="modoVideoImg" className="mt-1" checked={form.modoVideoImg === 'diretas'} onChange={() => setForm((f: any) => ({ ...f, modoVideoImg: 'diretas' }))} />
                <span><span className="font-medium">Usar as minhas imagens</span> — o vídeo é montado exatamente com as imagens que carregar.</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="radio" name="modoVideoImg" className="mt-1" checked={form.modoVideoImg === 'ia'} onChange={() => setForm((f: any) => ({ ...f, modoVideoImg: 'ia' }))} />
                <span><span className="font-medium">A IA cria as imagens</span> — inspirando-se nas que carregar (opcional), respeitando produtos e marca.</span>
              </label>
            </div>
            <div>
              <button type="button" onClick={() => refInput.current?.click()} disabled={uploadingRef} className="btn-secondary flex items-center gap-2 text-sm">{uploadingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Carregar imagens</button>
              <input ref={refInput} type="file" accept="image/*" multiple className="hidden" onChange={onRefUpload} />
            </div>
            {form.referencias?.length > 0 && (
              <div className="flex flex-wrap gap-3">{form.referencias.map((r: any, idx: number) => (
                <div key={r.path} className="relative w-24">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">{r.url && <Image src={r.url} alt="Imagem do vídeo" fill className="object-cover" />}<span className="absolute top-1 left-1 text-[10px] px-1.5 rounded-full bg-black/60 text-white">{idx + 1}</span></div>
                  <button type="button" onClick={() => removeRef(r.path)} className="w-full mt-1 text-[10px] rounded bg-muted px-1.5 py-0.5 flex items-center justify-center gap-1"><X className="h-3 w-3" />Remover</button>
                </div>
              ))}</div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {form.modoVideoImg === 'ia' && (
              <div><label className="label">Número de cenas</label><select value={form.nCenas} onChange={e => setForm((f: any) => ({ ...f, nCenas: parseInt(e.target.value, 10) }))} className="input w-full">{[2,3,4,5,6].map(n => <option key={n} value={n}>{n} cenas</option>)}</select></div>
            )}
            <div><label className="label">Duração por cena</label><select value={form.duracaoCena} onChange={e => setForm((f: any) => ({ ...f, duracaoCena: parseInt(e.target.value, 10) }))} className="input w-full">{[2,3,4,5].map(n => <option key={n} value={n}>{n} segundos</option>)}</select></div>
          </div>
          <button onClick={gerarVideo} disabled={busyVideo} className="btn-primary flex items-center gap-2 text-sm">{busyVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{busyVideo ? 'A gerar o short…' : 'Gerar short com IA'}</button>
          {form.videoUrl && (
            <div className="space-y-3">
              <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-xl overflow-hidden border bg-black">
                <video src={form.videoUrl} controls playsInline className="w-full h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <a href={form.videoUrl} target="_blank" rel="noopener" download className="btn-secondary flex items-center gap-2 text-sm"><Download className="h-4 w-4" />Descarregar vídeo</a>
                <button onClick={() => setForm((f: any) => ({ ...f, videoUrl: '', videoPath: '', roteiro: [] }))} className="btn-secondary text-sm">Remover</button>
              </div>
              {Array.isArray(form.roteiro) && form.roteiro.length > 0 && (
                <div><div className="text-xs font-medium text-muted-foreground mb-1">Guião gerado</div><ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">{form.roteiro.map((c: any, i: number) => <li key={i}>{c.texto}</li>)}</ol></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Imagem */}
      {!isVideo && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">Imagem</h3></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className="label">Descrição da imagem</label><input value={form.descricaoImagem} onChange={e => setForm((f: any) => ({ ...f, descricaoImagem: e.target.value }))} placeholder="Descreva a imagem a gerar" className="input w-full" /></div>
            <div><label className="label">Formato</label><select value={form.aspect} onChange={e => setForm((f: any) => ({ ...f, aspect: e.target.value }))} className="input w-full"><option value="1:1">Quadrado (1:1)</option><option value="4:3">Horizontal (4:3)</option><option value="3:4">Vertical (3:4)</option></select></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={gerarImagem} disabled={busyImg} className="btn-primary flex items-center gap-2 text-sm">{busyImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Gerar imagem com IA</button>
            <button onClick={() => refInput.current?.click()} disabled={uploadingRef} className="btn-secondary flex items-center gap-2 text-sm">{uploadingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Carregar exemplos</button>
            <input ref={refInput} type="file" accept="image/*" multiple className="hidden" onChange={onRefUpload} />
          </div>
          {form.imagemUrl && (
            <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden border bg-muted">
              <Image src={form.imagemUrl} alt="Imagem da publicação" fill className="object-cover" />
              <button onClick={() => setForm((f: any) => ({ ...f, imagemUrl: '', imagemPath: '' }))} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
            </div>
          )}
          {form.referencias?.length > 0 && (
            <div><div className="text-xs font-medium text-muted-foreground mb-1">Exemplos carregados (clique em "Usar" para definir como imagem da publicação)</div>
              <div className="flex flex-wrap gap-3">{form.referencias.map((r: any) => (
                <div key={r.path} className="relative w-24">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">{r.url && <Image src={r.url} alt="Exemplo" fill className="object-cover" />}</div>
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => usarComoImagem(r.url, r.path)} className="flex-1 text-[10px] rounded bg-fuchsia-600 text-white py-0.5">Usar</button>
                    <button onClick={() => removeRef(r.path)} className="text-[10px] rounded bg-muted px-1.5"><X className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}

      {/* Conteudo por rede social */}
      {form.plataformas.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">Conteúdo por rede social</h3></div>
          <p className="text-xs text-muted-foreground">Cada rede tem campos próprios. Reveja e edite o conteúdo adaptado a cada plataforma selecionada.</p>
          <div className="space-y-4">
            {form.plataformas.includes('facebook') && (
              <PlatBox icon={Facebook} cls="bg-blue-100 text-blue-600" nome="Facebook">
                <Campo label="Mensagem da publicação" ta rows={4} value={getPlat('facebook').mensagem || ''} onChange={(v: string) => setPlat('facebook', { mensagem: v })} placeholder="Texto que aparece na publicação do Facebook" />
                <Campo label="Chamada à ação (opcional)" value={getPlat('facebook').chamadaAcao || ''} onChange={(v: string) => setPlat('facebook', { chamadaAcao: v })} placeholder="Ex.: Peça já o seu orçamento" />
                <Campo label="Hashtags" value={asText(getPlat('facebook').hashtags)} onChange={(v: string) => setPlat('facebook', { hashtags: v })} placeholder="#impressao3d #kh43d" />
              </PlatBox>
            )}
            {form.plataformas.includes('instagram') && (
              <PlatBox icon={Instagram} cls="bg-pink-100 text-pink-600" nome="Instagram">
                <Campo label="Legenda" ta rows={4} value={getPlat('instagram').legenda || ''} onChange={(v: string) => setPlat('instagram', { legenda: v })} placeholder="Legenda apelativa do Instagram" />
                <Campo label="Primeiro comentário (hashtags)" ta rows={2} value={asText(getPlat('instagram').primeiroComentario)} onChange={(v: string) => setPlat('instagram', { primeiroComentario: v })} placeholder="Bloco de hashtags para o 1º comentário" />
                <Campo label="Hashtags" value={asText(getPlat('instagram').hashtags)} onChange={(v: string) => setPlat('instagram', { hashtags: v })} placeholder="#impressao3d #maker" />
              </PlatBox>
            )}
            {form.plataformas.includes('tiktok') && (
              <PlatBox icon={Music2} cls="bg-slate-200 text-slate-900" nome="TikTok">
                <Campo label="Legenda" ta rows={3} value={getPlat('tiktok').legenda || ''} onChange={(v: string) => setPlat('tiktok', { legenda: v })} placeholder="Legenda curta e direta" />
                <Campo label="Ganchos iniciais (um por linha)" ta rows={3} value={asLines(getPlat('tiktok').ganchos)} onChange={(v: string) => setPlat('tiktok', { ganchos: v })} placeholder="Frase de impacto para os primeiros segundos" />
                {/* ganchos: uma frase por linha */}
                <Campo label="Hashtags" value={asText(getPlat('tiktok').hashtags)} onChange={(v: string) => setPlat('tiktok', { hashtags: v })} placeholder="#fyp #impressao3d" />
              </PlatBox>
            )}
            {form.plataformas.includes('youtube_shorts') && (
              <PlatBox icon={Youtube} cls="bg-red-100 text-red-600" nome="YouTube Shorts">
                <Campo label="Título (máx. 100 caracteres)" value={getPlat('youtube_shorts').titulo || ''} onChange={(v: string) => setPlat('youtube_shorts', { titulo: v.slice(0, 100) })} placeholder="Título forte do short" />
                <Campo label="Descrição" ta rows={4} value={getPlat('youtube_shorts').descricao || ''} onChange={(v: string) => setPlat('youtube_shorts', { descricao: v })} placeholder="Descrição do short" />
                <Campo label="Etiquetas (tags)" value={asText(getPlat('youtube_shorts').tags)} onChange={(v: string) => setPlat('youtube_shorts', { tags: v })} placeholder="impressão 3d, prototipagem" />
              </PlatBox>
            )}
          </div>
        </div>
      )}
      {/* Agendamento */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-fuchsia-600" /><h3 className="font-semibold">Agendamento</h3></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Data</label><input type="date" value={form.agendadoData} onChange={e => setForm((f: any) => ({ ...f, agendadoData: e.target.value }))} className="input w-full" /></div>
          <div><label className="label">Hora</label><input type="time" value={form.agendadoHora} onChange={e => setForm((f: any) => ({ ...f, agendadoHora: e.target.value }))} className="input w-full" /></div>
        </div>
        <div><label className="label">Notas internas (opcional)</label><textarea value={form.notas} onChange={e => setForm((f: any) => ({ ...f, notas: e.target.value }))} rows={2} className="input w-full" /></div>
        <p className="text-xs text-muted-foreground">Nota: a publicação automática nas redes ainda não está ativa (requer as ligações — ver secção "Ligações"). Por agora, na data marcada o conteúdo fica pronto para publicar com um clique.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={() => salvar('rascunho')} disabled={saving} className="btn-secondary flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar rascunho</button>
        <button onClick={() => salvar('agendado')} disabled={saving} className="btn-primary flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}<Clock className="h-4 w-4" />Agendar</button>
      </div>
    </div>
  );
}

function Agenda({ posts, onEdit, onNew }: any) {
  const agendadas = posts.filter((p: Post) => p.agendadoEm).sort((a: Post, b: Post) => new Date(a.agendadoEm!).getTime() - new Date(b.agendadoEm!).getTime());
  const grupos: Record<string, Post[]> = {};
  agendadas.forEach((p: Post) => { const k = new Date(p.agendadoEm!).toISOString().slice(0, 10); (grupos[k] = grupos[k] || []).push(p); });
  const dias = Object.keys(grupos).sort();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Agenda</h2><button onClick={onNew} className="btn-primary flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4" />Nova publicação</button></div>
      {dias.length === 0 ? <div className="card p-8 text-center text-muted-foreground">Sem publicações com data definida.</div> : dias.map(d => (
        <div key={d} className="card p-4">
          <div className="text-sm font-semibold mb-3">{new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="space-y-2">{grupos[d].map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium tabular-nums w-12">{new Date(p.agendadoEm!).toTimeString().slice(0, 5)}</span>
              <PlatIcons plats={p.plataformas} />
              <div className="flex-1 min-w-0"><div className="font-medium truncate flex items-center gap-2">{p.formato === 'video' && <Film className="h-3.5 w-3.5 text-fuchsia-600" />}{p.titulo}</div></div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_CLASS[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
              <button onClick={() => onEdit(p)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
            </div>
          ))}</div>
        </div>
      ))}
    </div>
  );
}

function Publicacoes({ posts, onEdit, onDelete, onPublish, onCopy, onNew }: any) {
  const [filtro, setFiltro] = useState('todos');
  const lista = filtro === 'todos' ? posts : posts.filter((p: Post) => p.estado === filtro);
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Publicações</h2>
        <div className="flex items-center gap-2">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className="input"><option value="todos">Todas</option><option value="rascunho">Rascunhos</option><option value="agendado">Agendadas</option><option value="publicado">Publicadas</option></select>
          <button onClick={onNew} className="btn-primary flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4" />Nova</button>
        </div>
      </div>
      {lista.length === 0 ? <div className="card p-8 text-center text-muted-foreground">Sem publicações.</div> : (
        <div className="grid sm:grid-cols-2 gap-4">{lista.map((p: Post) => (
          <div key={p.id} className="card overflow-hidden flex flex-col">
            {p.formato === 'video' && p.videoUrl ? (
              <div className="relative w-full bg-black flex justify-center"><video src={p.videoUrl} controls playsInline className="max-h-72" /></div>
            ) : p.imagemUrl ? (
              <div className="relative w-full aspect-video bg-muted"><Image src={p.imagemUrl} alt={p.titulo} fill className="object-cover" /></div>
            ) : (
              <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground">{p.formato === 'video' ? <Film className="h-8 w-8" /> : <ImagePlus className="h-8 w-8" />}</div>
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <PlatIcons plats={p.plataformas} />
                {p.formato === 'video' && <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700"><Film className="h-3 w-3" />Short</span>}
                {p.tipo === 'anuncio' && <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700"><Megaphone className="h-3 w-3" />Anúncio</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${ESTADO_CLASS[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
              </div>
              <div className="font-semibold">{p.titulo}</div>
              {p.texto && <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{p.texto}</p>}
              {p.agendadoEm && <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(p.agendadoEm)}</div>}
              <div className="flex items-center gap-1 mt-auto pt-2 border-t">
                <button onClick={() => onCopy(p.texto)} title="Copiar texto" className="p-1.5 rounded hover:bg-muted"><Copy className="h-4 w-4" /></button>
                {p.imagemUrl && <a href={p.imagemUrl} target="_blank" rel="noopener" download title="Descarregar imagem" className="p-1.5 rounded hover:bg-muted"><Download className="h-4 w-4" /></a>}
                {p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noopener" download title="Descarregar vídeo" className="p-1.5 rounded hover:bg-muted"><Film className="h-4 w-4" /></a>}
                <button onClick={() => onEdit(p)} title="Editar" className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                {p.estado !== 'publicado' && <button onClick={() => onPublish(p.id)} title="Marcar como publicada" className="p-1.5 rounded hover:bg-muted text-emerald-600"><Send className="h-4 w-4" /></button>}
                <button onClick={() => onDelete(p.id)} title="Eliminar" className="p-1.5 rounded hover:bg-muted text-rose-500 ml-auto"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

const CAMP_EMPTY = { id: '', nome: '', objetivo: 'notoriedade', plataformas: ['facebook'] as string[], estado: 'planeada', orcamento: '', gastoAtual: '', inicio: '', fim: '', impressoes: '', alcance: '', cliques: '', conversoes: '', notas: '' };

function Campanhas({ campanhas, posts, reload }: any) {
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const novo = () => setEditing({ ...CAMP_EMPTY });
  const abrir = (c: Campanha) => setEditing({
    id: c.id, nome: c.nome, objetivo: c.objetivo || 'notoriedade', plataformas: (c.plataformas || '').split(',').filter(Boolean),
    estado: c.estado, orcamento: c.orcamento ?? '', gastoAtual: c.gastoAtual ?? '', inicio: c.inicio ? c.inicio.slice(0, 10) : '', fim: c.fim ? c.fim.slice(0, 10) : '',
    impressoes: c.impressoes ?? '', alcance: c.alcance ?? '', cliques: c.cliques ?? '', conversoes: c.conversoes ?? '', notas: c.notas || '',
  });

  const guardar = async () => {
    if (!editing.nome?.trim()) { toast.error('Dê um nome à campanha'); return; }
    setSaving(true);
    try {
      const body = {
        nome: editing.nome, objetivo: editing.objetivo, plataformas: (editing.plataformas || []).join(','), estado: editing.estado,
        orcamento: editing.orcamento === '' ? null : Number(editing.orcamento), gastoAtual: editing.gastoAtual === '' ? null : Number(editing.gastoAtual),
        inicio: editing.inicio || null, fim: editing.fim || null,
        impressoes: editing.impressoes === '' ? null : Number(editing.impressoes), alcance: editing.alcance === '' ? null : Number(editing.alcance),
        cliques: editing.cliques === '' ? null : Number(editing.cliques), conversoes: editing.conversoes === '' ? null : Number(editing.conversoes), notas: editing.notas,
      };
      const url = editing.id ? `/api/redes-sociais/campanhas/${editing.id}` : '/api/redes-sociais/campanhas';
      const method = editing.id ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success('Campanha guardada'); setEditing(null); reload();
    } catch { toast.error('Erro ao guardar a campanha'); } finally { setSaving(false); }
  };

  const eliminar = async (id: string) => { if (!confirm('Eliminar esta campanha?')) return; await fetch(`/api/redes-sociais/campanhas/${id}`, { method: 'DELETE' }); toast.success('Campanha eliminada'); reload(); };

  const togglePlat = (p: string) => setEditing((e: any) => ({ ...e, plataformas: e.plataformas.includes(p) ? e.plataformas.filter((x: string) => x !== p) : [...e.plataformas, p] }));
  const nPosts = (id: string) => posts.filter((p: Post) => p.campanhaId === id).length;

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing.id ? 'Editar campanha' : 'Nova campanha'}</h2><button onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancelar</button></div>
        <div className="card p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Nome da campanha *</label><input value={editing.nome} onChange={e => setEditing((s: any) => ({ ...s, nome: e.target.value }))} className="input w-full" placeholder="Ex.: Campanha Natal 2026" /></div>
            <div><label className="label">Objetivo</label><select value={editing.objetivo} onChange={e => setEditing((s: any) => ({ ...s, objetivo: e.target.value }))} className="input w-full"><option value="notoriedade">Notoriedade</option><option value="trafego">Tráfego</option><option value="interacao">Interação</option><option value="leads">Contactos (leads)</option><option value="vendas">Vendas</option></select></div>
          </div>
          <div>
            <label className="label">Plataformas</label>
            <div className="flex flex-wrap gap-2">{PLATAFORMAS.map(p => (
              <button key={p.key} type="button" onClick={() => togglePlat(p.key)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${editing.plataformas.includes(p.key) ? p.active : 'hover:bg-muted'}`}><p.icon className="h-4 w-4" />{p.label}</button>
            ))}</div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Estado</label><select value={editing.estado} onChange={e => setEditing((s: any) => ({ ...s, estado: e.target.value }))} className="input w-full"><option value="planeada">Planeada</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></div>
            <div><label className="label">Orçamento (€)</label><input type="number" step="0.01" value={editing.orcamento} onChange={e => setEditing((s: any) => ({ ...s, orcamento: e.target.value }))} className="input w-full" /></div>
            <div><label className="label">Gasto atual (€)</label><input type="number" step="0.01" value={editing.gastoAtual} onChange={e => setEditing((s: any) => ({ ...s, gastoAtual: e.target.value }))} className="input w-full" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Início</label><input type="date" value={editing.inicio} onChange={e => setEditing((s: any) => ({ ...s, inicio: e.target.value }))} className="input w-full" /></div>
            <div><label className="label">Fim</label><input type="date" value={editing.fim} onChange={e => setEditing((s: any) => ({ ...s, fim: e.target.value }))} className="input w-full" /></div>
          </div>
          <div>
            <label className="label">Resultados (atualização manual enquanto a ligação automática não está ativa)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className="text-[11px] text-muted-foreground">Impressões</label><input type="number" value={editing.impressoes} onChange={e => setEditing((s: any) => ({ ...s, impressoes: e.target.value }))} className="input w-full" /></div>
              <div><label className="text-[11px] text-muted-foreground">Alcance</label><input type="number" value={editing.alcance} onChange={e => setEditing((s: any) => ({ ...s, alcance: e.target.value }))} className="input w-full" /></div>
              <div><label className="text-[11px] text-muted-foreground">Cliques</label><input type="number" value={editing.cliques} onChange={e => setEditing((s: any) => ({ ...s, cliques: e.target.value }))} className="input w-full" /></div>
              <div><label className="text-[11px] text-muted-foreground">Conversões</label><input type="number" value={editing.conversoes} onChange={e => setEditing((s: any) => ({ ...s, conversoes: e.target.value }))} className="input w-full" /></div>
            </div>
          </div>
          <div><label className="label">Notas (opcional)</label><textarea value={editing.notas} onChange={e => setEditing((s: any) => ({ ...s, notas: e.target.value }))} rows={2} className="input w-full" /></div>
          <div className="flex justify-end"><button onClick={guardar} disabled={saving} className="btn-primary flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar campanha</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Campanhas</h2><button onClick={novo} className="btn-primary flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4" />Nova campanha</button></div>
      {campanhas.length === 0 ? <div className="card p-8 text-center text-muted-foreground">Ainda não tem campanhas. Crie uma para acompanhar orçamento, gastos e resultados.</div> : (
        <div className="grid sm:grid-cols-2 gap-4">{campanhas.map((c: Campanha) => {
          const pct = c.orcamento ? Math.min(100, Math.round(((c.gastoAtual || 0) / c.orcamento) * 100)) : 0;
          return (
            <div key={c.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{c.nome}</div><div className="text-xs text-muted-foreground capitalize">{c.objetivo || '—'}</div></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${CAMP_ESTADO_CLASS[c.estado]}`}>{CAMP_ESTADO_LABEL[c.estado]}</span>
              </div>
              <PlatIcons plats={c.plataformas} />
              <div>
                <div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground">Gasto / Orçamento</span><span className="font-medium">{fmtEur(c.gastoAtual)} / {fmtEur(c.orcamento)}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-fuchsia-500" style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Metric icon={Eye} label="Impr." value={fmtNum(c.impressoes)} />
                <Metric icon={Users} label="Alcance" value={fmtNum(c.alcance)} />
                <Metric icon={MousePointerClick} label="Cliques" value={fmtNum(c.cliques)} />
                <Metric icon={Target} label="Conv." value={fmtNum(c.conversoes)} />
              </div>
              {(c.inicio || c.fim) && <div className="text-xs text-muted-foreground">{c.inicio ? new Date(c.inicio).toLocaleDateString('pt-PT') : '—'} → {c.fim ? new Date(c.fim).toLocaleDateString('pt-PT') : '—'}</div>}
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">{nPosts(c.id)} publicação(ões)</span>
                <button onClick={() => abrir(c)} className="ml-auto p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => eliminar(c.id)} className="p-1.5 rounded hover:bg-muted text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}</div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg bg-muted/50 py-2">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
      <div className="text-sm font-semibold leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

const LIGACOES_CFG: { key: string; nome: string; icon: any; cls: string; desc: string; campos: { k: string; label: string; tipo?: string; dica?: string }[]; passos: string[] }[] = [
  {
    key: 'facebook', nome: 'Facebook (Página kh43d)', icon: Facebook, cls: 'bg-blue-100 text-blue-600',
    desc: 'Publicação automática de publicações na Página.',
    campos: [
      { k: 'pageId', label: 'ID da Página', tipo: 'text', dica: 'Definições da Página → Acerca → ID da Página.' },
      { k: 'accessToken', label: 'Token de acesso da Página', tipo: 'password', dica: 'Token de longa duração gerado no Explorador da Graph API.' },
    ],
    passos: [
      'Aceda a developers.facebook.com e inicie sessão com a conta que gere a Página kh43d.',
      'Crie uma aplicação do tipo "Empresa" e adicione as permissões pages_show_list, pages_read_engagement e pages_manage_posts.',
      'No Explorador da Graph API, escolha a aplicação e a Página kh43d e gere um token de acesso da Página (de preferência de longa duração).',
      'Copie o ID da Página e o token para os campos abaixo e clique em "Guardar e verificar".',
    ],
  },
  {
    key: 'instagram', nome: 'Instagram Business', icon: Instagram, cls: 'bg-pink-100 text-pink-600',
    desc: 'Publicação automática de publicações e Reels.',
    campos: [
      { k: 'igBusinessId', label: 'ID da conta Instagram Business', tipo: 'text', dica: 'Obtido pela Graph API a partir da Página associada.' },
      { k: 'accessToken', label: 'Token de acesso (Meta)', tipo: 'password', dica: 'Pode ser o mesmo token da Página do Facebook.' },
    ],
    passos: [
      'Converta a conta Instagram para conta Profissional/Business e associe-a à Página kh43d do Facebook.',
      'Na mesma aplicação Meta, adicione as permissões instagram_basic e instagram_content_publish.',
      'Obtenha o ID da conta Instagram Business (campo instagram_business_account da Página) através da Graph API.',
      'Copie o ID e o token para os campos abaixo e clique em "Guardar e verificar".',
    ],
  },
  {
    key: 'tiktok', nome: 'TikTok', icon: Music2, cls: 'bg-slate-200 text-slate-900',
    desc: 'Publicação automática de vídeos.',
    campos: [
      { k: 'accessToken', label: 'Token de acesso (access token)', tipo: 'password', dica: 'Gerado no fluxo OAuth do TikTok for Developers.' },
    ],
    passos: [
      'Crie uma conta em developers.tiktok.com e registe uma aplicação.',
      'Peça acesso ao Content Posting API e às permissões user.info.basic e video.publish.',
      'Autorize a conta TikTok da empresa e gere um token de acesso (user access token).',
      'Copie o token para o campo abaixo e clique em "Guardar e verificar".',
    ],
  },
  {
    key: 'youtube_shorts', nome: 'YouTube Shorts', icon: Youtube, cls: 'bg-red-100 text-red-600',
    desc: 'Publicação automática de shorts.',
    campos: [
      { k: 'apiKey', label: 'Chave da API (API key)', tipo: 'password', dica: 'Google Cloud → Credenciais → Chave de API.' },
      { k: 'channelId', label: 'ID do canal', tipo: 'text', dica: 'Começa por UC... (Definições avançadas do canal).' },
    ],
    passos: [
      'Crie um projeto na Google Cloud Console e ative a YouTube Data API v3.',
      'Em Credenciais, crie uma Chave de API.',
      'Copie o ID do canal (Definições do YouTube → Avançadas).',
      'Cole a chave e o ID nos campos abaixo e clique em "Guardar e verificar".',
    ],
  },
];

function Ligacoes() {
  const [estado, setEstado] = useState<Record<string, any>>({});
  const [valores, setValores] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  const carregar = async () => {
    try {
      const r = await fetch('/api/redes-sociais/ligacoes');
      if (r.ok) { const d = await r.json(); setEstado(d.ligacoes || {}); }
    } catch {} finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const setCampo = (plat: string, k: string, v: string) =>
    setValores(s => ({ ...s, [plat]: { ...(s[plat] || {}), [k]: v } }));

  const guardar = async (plat: string) => {
    setBusy(plat);
    try {
      const r = await fetch('/api/redes-sociais/ligacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plataforma: plat, credenciais: valores[plat] || {} }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Erro');
      if (d.success) {
        toast.success(`Ligação verificada${d.contaNome ? ` — ${d.contaNome}` : ''}`);
      } else {
        toast.error(d.erro || 'Não foi possível verificar. Reveja as credenciais.');
      }
      // limpar campos de segredo após guardar
      setValores(s => ({ ...s, [plat]: {} }));
      await carregar();
    } catch (e: any) { toast.error(e?.message || 'Erro ao verificar a ligação'); } finally { setBusy(null); }
  };

  const desligar = async (plat: string) => {
    if (!confirm('Remover as credenciais e desligar esta rede?')) return;
    setBusy(plat);
    try {
      await fetch(`/api/redes-sociais/ligacoes?plataforma=${plat}`, { method: 'DELETE' });
      toast.success('Rede desligada');
      await carregar();
    } catch { toast.error('Erro ao desligar'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Ligações às redes sociais</h2>
        <p className="text-sm text-muted-foreground mt-1">Siga os passos de cada rede, cole as credenciais e clique em "Guardar e verificar". Se estiver tudo correto, o estado muda para <b>Ligado</b>.</p>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-fuchsia-600" /></div>
      ) : (
        <div className="space-y-4">
          {LIGACOES_CFG.map((cfg) => {
            const st = estado[cfg.key] || {};
            const ligado = !!st.ligado;
            const isOpen = aberto[cfg.key] ?? !ligado;
            return (
              <div key={cfg.key} className="card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`flex items-center justify-center h-10 w-10 rounded-xl ${cfg.cls}`}><cfg.icon className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{cfg.nome}</div>
                    <div className="text-xs text-muted-foreground">{cfg.desc}</div>
                  </div>
                  {ligado
                    ? <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" />Ligado</span>
                    : <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Não ligado</span>}
                </div>

                {ligado && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    Conta ligada{st.contaNome ? `: ${st.contaNome}` : ''}{st.verificadoEm ? ` — verificada em ${formatDateTime(st.verificadoEm)}` : ''}.
                  </div>
                )}
                {!ligado && st.ultimoErro && (
                  <div className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">Última tentativa falhou: {st.ultimoErro}</div>
                )}

                <button type="button" onClick={() => setAberto(a => ({ ...a, [cfg.key]: !isOpen }))} className="text-xs font-medium text-fuchsia-600 hover:underline">
                  {isOpen ? 'Ocultar instruções e credenciais' : (ligado ? 'Atualizar credenciais' : 'Ver instruções e ligar')}
                </button>

                {isOpen && (
                  <div className="space-y-4 pt-1">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-xs font-semibold mb-1">Como obter as credenciais</div>
                      <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                        {cfg.passos.map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {cfg.campos.map((c) => {
                        const preenchido = st.preenchidos?.[c.k];
                        return (
                          <div key={c.k} className={cfg.campos.length === 1 ? 'sm:col-span-2' : ''}>
                            <label className="label">{c.label}{preenchido ? <span className="ml-2 text-[10px] text-emerald-600">(guardado)</span> : null}</label>
                            <input
                              type={c.tipo === 'password' ? 'password' : 'text'}
                              value={(valores[cfg.key] || {})[c.k] || ''}
                              onChange={e => setCampo(cfg.key, c.k, e.target.value)}
                              placeholder={preenchido ? '•••••••• (deixe em branco para manter)' : c.label}
                              className="input w-full"
                              autoComplete="off"
                            />
                            {c.dica && <p className="text-[11px] text-muted-foreground mt-1">{c.dica}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => guardar(cfg.key)} disabled={busy === cfg.key} className="btn-primary flex items-center gap-2 text-sm">
                        {busy === cfg.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}Guardar e verificar
                      </button>
                      {ligado && (
                        <button type="button" onClick={() => desligar(cfg.key)} disabled={busy === cfg.key} className="btn-secondary flex items-center gap-2 text-sm"><X className="h-4 w-4" />Desligar</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4 text-xs text-muted-foreground">
        As credenciais são guardadas de forma segura e usadas apenas para validar o acesso a cada rede. "Ligado" significa que as credenciais foram validadas com sucesso; a publicação totalmente automática é ativada a seguir, rede a rede.
      </div>
    </div>
  );
}