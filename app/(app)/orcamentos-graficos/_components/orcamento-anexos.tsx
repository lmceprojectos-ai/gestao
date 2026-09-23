'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, Loader2, Trash2, Download, Eye, X, FileText, ImageIcon, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

type Anexo = {
  id: string;
  cloudStoragePath: string;
  contentType: string | null;
  nomeOriginal: string | null;
  descricao: string | null;
  orientacao: string | null;
  tipo: string | null;
  criadoPor: string | null;
  createdAt: string;
  url?: string | null;
};

const TIPOS = [
  { value: 'ficheiro_final', label: 'Ficheiro final' },
  { value: 'foto', label: 'Foto do trabalho' },
];
const ORIENTACOES = [
  { value: 'vertical', label: 'A4 Vertical' },
  { value: 'horizontal', label: 'A4 Horizontal' },
];

function ehImagem(ct: string | null | undefined) {
  return !!ct && ct.startsWith('image/');
}

export function OrcamentoAnexos({ orcamentoId }: { orcamentoId: string }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState('ficheiro_final');
  const [orientacao, setOrientacao] = useState('vertical');
  const [descricao, setDescricao] = useState('');
  const [preview, setPreview] = useState<Anexo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/grafica/orcamentos/${orcamentoId}/anexos`);
      const d = await r.json();
      setAnexos(Array.isArray(d) ? d : []);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Ficheiro demasiado grande (máx. 100 MB)');
      return;
    }
    setUploading(true);
    try {
      const presRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
      });
      const pres = await presRes.json();
      if (!presRes.ok) throw new Error(pres.error || 'Erro ao preparar o upload');
      const put = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('Erro ao enviar o ficheiro');
      const r = await fetch(`/api/grafica/orcamentos/${orcamentoId}/anexos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudStoragePath: pres.cloud_storage_path,
          contentType: file.type,
          nomeOriginal: file.name,
          descricao,
          orientacao: tipo === 'ficheiro_final' ? orientacao : null,
          tipo,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Erro ao guardar o anexo');
      }
      toast.success('Ficheiro anexado');
      setDescricao('');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao anexar o ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const descarregar = async (a: Anexo) => {
    try {
      const r = await fetch(`/api/grafica/orcamentos/${orcamentoId}/anexos/${a.id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao obter o ficheiro');
      const link = document.createElement('a');
      link.href = d.url;
      link.download = d.nome || a.nomeOriginal || 'ficheiro';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao descarregar');
    }
  };

  const eliminar = async (a: Anexo) => {
    if (!confirm('Eliminar este anexo? Esta ação é irreversível.')) return;
    try {
      const r = await fetch(`/api/grafica/orcamentos/${orcamentoId}/anexos/${a.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Erro ao eliminar');
      toast.success('Anexo eliminado');
      setAnexos((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao eliminar');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Paperclip className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold">Ficheiros / Trabalho produzido</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">Anexe o ficheiro final do trabalho (ajustado a A4 vertical ou horizontal) ou uma foto do trabalho produzido, para consulta futura. Aceita imagens e PDF.</p>

      {/* Formulário de upload */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {tipo === 'ficheiro_final' && (
            <div>
              <label className={labelCls}>Orientação (A4)</label>
              <select value={orientacao} onChange={(e) => setOrientacao(e.target.value)} className={inputCls}>
                {ORIENTACOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Descrição (opcional)</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Arte final aprovada, foto da montagem no cliente…" className={inputCls} />
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'A enviar…' : 'Escolher e anexar ficheiro'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
      </div>

      {/* Lista de anexos */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : anexos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">Ainda não existem ficheiros anexados a este orçamento.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {anexos.map((a) => (
              <div key={a.id} className="rounded-xl border border-border overflow-hidden bg-background flex flex-col">
                <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
                  {ehImagem(a.contentType) && a.url ? (
                    <Image src={a.url} alt={a.descricao || a.nomeOriginal || 'Anexo'} fill className="object-cover" unoptimized />
                  ) : (
                    <FileText className="h-10 w-10 text-emerald-600/70" />
                  )}
                  <div className="absolute top-1.5 left-1.5 flex gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
                      {a.tipo === 'foto' ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      {a.tipo === 'foto' ? 'Foto' : 'Final'}
                    </span>
                    {a.orientacao && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-600/90 text-white">{a.orientacao === 'horizontal' ? 'Horiz.' : 'Vert.'}</span>
                    )}
                  </div>
                </div>
                <div className="p-2 flex-1 flex flex-col gap-1">
                  <div className="text-xs font-medium text-foreground truncate" title={a.descricao || a.nomeOriginal || ''}>{a.descricao || a.nomeOriginal || 'Ficheiro'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{a.nomeOriginal}</div>
                  <div className="flex items-center gap-1 mt-auto pt-1">
                    {ehImagem(a.contentType) && a.url && (
                      <button onClick={() => setPreview(a)} className="p-1.5 rounded-lg border border-input bg-background hover:bg-muted text-emerald-600" title="Ver">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => descarregar(a)} className="p-1.5 rounded-lg border border-input bg-background hover:bg-muted text-slate-600" title="Descarregar">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => eliminar(a)} className="p-1.5 rounded-lg border border-input bg-background hover:bg-red-50 text-red-600 ml-auto" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de pré-visualização de imagem */}
      {preview && preview.url && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-3 sm:p-6" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold truncate">{preview.descricao || preview.nomeOriginal || 'Anexo'}</div>
              <button onClick={() => setPreview(null)} className="p-2 rounded-lg border border-input bg-background hover:bg-muted" title="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative flex-1 min-h-[50vh] bg-muted">
              <Image src={preview.url} alt={preview.descricao || 'Anexo'} fill className="object-contain" unoptimized />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
