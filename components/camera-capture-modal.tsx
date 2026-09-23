'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, Check, RefreshCw } from 'lucide-react';
import { applyScanMode, SCAN_MODES, ScanMode } from '@/lib/scan-filter';

interface CameraCaptureModalProps {
  /** Rácio largura/altura da moldura (cartão ID-1 ≈ 1.586). */
  aspect: number;
  title?: string;
  /** Devolve a imagem já recortada à moldura. */
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  /** Permite ao utilizador optar por escolher um ficheiro em vez da câmara. */
  onUseFile?: () => void;
}

interface Rect { x: number; y: number; w: number; h: number; }

/**
 * Câmara ao vivo com uma moldura retangular no formato exato do cartão.
 * O utilizador arrasta a moldura (e ajusta o tamanho no slider) até o cartão
 * ficar enquadrado, e só depois captura. A foto é recortada à moldura.
 */
export function CameraCaptureModal({ aspect, title, onCapture, onCancel, onUseFile }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [box, setBox] = useState<{ cw: number; ch: number }>({ cw: 0, ch: 0 });
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [sizePct, setSizePct] = useState(0.85);

  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Revisão depois de tirar a foto (por defeito mostra a ORIGINAL, sem digitalizar)
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<ScanMode>('cor');

  // Iniciar a câmara
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e: any) {
        if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
          setError('Sem permissão para aceder à câmara. Autorize o acesso nas definições do navegador ou escolha um ficheiro.');
        } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
          setError('Não foi encontrada nenhuma câmara neste dispositivo. Pode escolher um ficheiro.');
        } else {
          setError('Não foi possível abrir a câmara. Pode escolher um ficheiro.');
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Medir o container e inicializar/reposicionar a moldura
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ cw: r.width, ch: r.height });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Recalcular a moldura quando muda o tamanho do container ou o slider
  useEffect(() => {
    if (box.cw === 0 || box.ch === 0) return;
    setRect((prev) => {
      const maxW = box.cw * 0.94;
      const maxH = box.ch * 0.8;
      let w = box.cw * sizePct;
      let h = w / aspect;
      if (w > maxW) { w = maxW; h = w / aspect; }
      if (h > maxH) { h = maxH; w = h * aspect; }
      // manter centrado se ainda não havia moldura, senão manter o centro atual
      const hadRect = prev.w > 0;
      const cx = hadRect ? prev.x + prev.w / 2 : box.cw / 2;
      const cy = hadRect ? prev.y + prev.h / 2 : box.ch / 2;
      let x = cx - w / 2;
      let y = cy - h / 2;
      x = Math.max(0, Math.min(x, box.cw - w));
      y = Math.max(0, Math.min(y, box.ch - h));
      return { x, y, w, h };
    });
  }, [box, sizePct, aspect]);

  // Arrastar a moldura
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - rect.x - (containerRect().left), dy: e.clientY - rect.y - (containerRect().top) };
  };
  const containerRect = () => containerRef.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const cr = containerRect();
    let x = e.clientX - cr.left - dragRef.current.dx;
    let y = e.clientY - cr.top - dragRef.current.dy;
    x = Math.max(0, Math.min(x, box.cw - rect.w));
    y = Math.max(0, Math.min(y, box.ch - rect.h));
    setRect((p) => ({ ...p, x, y }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Aplica um modo sobre uma cópia da captura original e devolve um data URL.
  const renderWithMode = (mode: ScanMode): string | null => {
    const raw = rawCanvasRef.current;
    if (!raw) return null;
    const tmp = document.createElement('canvas');
    tmp.width = raw.width; tmp.height = raw.height;
    const ctx = tmp.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(raw, 0, 0);
    if (mode !== 'cor') { try { applyScanMode(tmp, mode); } catch {} }
    const url = tmp.toDataURL('image/jpeg', 0.92);
    tmp.width = 1; tmp.height = 1;
    return url;
  };

  const changeReviewMode = (mode: ScanMode) => {
    setReviewMode(mode);
    setReviewUrl(renderWithMode(mode));
  };

  const handleRetake = () => {
    rawCanvasRef.current = null;
    setReviewUrl(null);
    setReviewMode('cor');
  };

  const handleConfirmReview = () => {
    const raw = rawCanvasRef.current;
    if (!raw) return;
    setProcessing(true);
    const tmp = document.createElement('canvas');
    tmp.width = raw.width; tmp.height = raw.height;
    const ctx = tmp.getContext('2d');
    if (!ctx) { setProcessing(false); return; }
    ctx.drawImage(raw, 0, 0);
    if (reviewMode !== 'cor') { try { applyScanMode(tmp, reviewMode); } catch {} }
    tmp.toBlob((blob) => {
      tmp.width = 1; tmp.height = 1;
      if (blob) onCapture(blob);
      else setProcessing(false);
    }, 'image/jpeg', 0.92);
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    setProcessing(true);
    try {
      // Geometria do vídeo apresentado com object-contain
      const scale = Math.min(box.cw / vw, box.ch / vh);
      const dispW = vw * scale;
      const dispH = vh * scale;
      const offX = (box.cw - dispW) / 2;
      const offY = (box.ch - dispH) / 2;

      // Mapear a moldura (coords do container) para coords do vídeo
      let sx = (rect.x - offX) / scale;
      let sy = (rect.y - offY) / scale;
      let sw = rect.w / scale;
      let sh = rect.h / scale;
      // Limitar dentro do frame
      sx = Math.max(0, Math.min(sx, vw));
      sy = Math.max(0, Math.min(sy, vh));
      sw = Math.min(sw, vw - sx);
      sh = Math.min(sh, vh - sy);

      // Canvas de saída (limitar lado maior a 2000px)
      const maxSide = 2000;
      const outScale = Math.min(1, maxSide / Math.max(sw, sh));
      const outW = Math.max(1, Math.round(sw * outScale));
      const outH = Math.max(1, Math.round(sh * outScale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setProcessing(false); return; }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

      // Guardar a captura ORIGINAL (sem qualquer filtro) para revisão.
      rawCanvasRef.current = canvas;
      setReviewMode('cor');
      setReviewUrl(renderWithMode('cor'));
      setProcessing(false);
    } catch {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-black/60">
        <button onClick={onCancel} className="text-white flex items-center gap-1 text-sm hover:text-gray-300"><X className="h-5 w-5" />Cancelar</button>
        <span className="text-white text-sm font-medium flex items-center gap-1.5"><Camera className="h-4 w-4" />{title || 'Enquadrar o cartão'}</span>
        <span className="w-16" />
      </div>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <p className="text-white/90 text-sm max-w-xs">{error}</p>
          {onUseFile && (
            <button onClick={onUseFile} className="flex items-center gap-2 bg-white text-gray-900 rounded-lg px-4 py-2.5 text-sm font-medium"><ImageIcon className="h-4 w-4" />Escolher um ficheiro</button>
          )}
        </div>
      ) : reviewUrl ? (
        /* Ecrã de revisão — mostra a ORIGINAL por defeito; utilizador escolhe se digitaliza */
        <>
          <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-black p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reviewUrl} alt="Pré-visualização do documento" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
          <div className="px-4 pt-3 bg-black/60">
            <p className="text-center text-white/70 text-xs mb-2">Escolha o aspeto. Por defeito fica a <strong>original</strong>.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {SCAN_MODES.map((m) => (
                <button key={m.id} onClick={() => changeReviewMode(m.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${reviewMode === m.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-black/60">
            <button onClick={handleRetake} disabled={processing} className="text-white/80 flex items-center gap-1.5 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Repetir</button>
            <button onClick={handleConfirmReview} disabled={processing} className="flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Usar esta foto</button>
          </div>
        </>
      ) : (
        <>
          {/* Área da câmara */}
          <div ref={containerRef} className="relative flex-1 overflow-hidden touch-none select-none">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain bg-black" />

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/80" /></div>
            )}

            {/* Escurecimento fora da moldura */}
            {rect.w > 0 && (
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'rgba(0,0,0,0.5)',
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x}px ${rect.y}px, ${rect.x}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y}px, ${rect.x}px ${rect.y}px)`,
              }} />
            )}

            {/* Moldura arrastável */}
            {rect.w > 0 && (
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="absolute cursor-move"
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              >
                <div className="w-full h-full border-2 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0)]" />
                {/* Cantos */}
                {['-top-1 -left-1', '-top-1 -right-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((c) => (
                  <span key={c} className={`absolute ${c} h-4 w-4 border-emerald-400`} style={{
                    borderTopWidth: c.includes('top') ? 3 : 0,
                    borderBottomWidth: c.includes('bottom') ? 3 : 0,
                    borderLeftWidth: c.includes('left') ? 3 : 0,
                    borderRightWidth: c.includes('right') ? 3 : 0,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Ajuste de tamanho */}
          <div className="px-4 pt-3 bg-black/60">
            <div className="flex items-center gap-3 max-w-md mx-auto">
              <span className="text-white/70 text-xs whitespace-nowrap">Tamanho</span>
              <input type="range" min={0.4} max={0.95} step={0.01} value={sizePct} onChange={(e) => setSizePct(Number(e.target.value))} className="flex-1 accent-emerald-500" />
            </div>
            <p className="text-center text-white/60 text-xs mt-2">Arraste a moldura e ajuste o tamanho até o cartão ficar dentro do retângulo.</p>
          </div>

          {/* Controlos */}
          <div className="flex items-center justify-between p-4 bg-black/60">
            {onUseFile ? (
              <button onClick={onUseFile} className="text-white/80 flex flex-col items-center gap-1 text-xs w-16"><ImageIcon className="h-5 w-5" />Ficheiro</button>
            ) : <span className="w-16" />}
            <button onClick={handleCapture} disabled={!ready || processing} className="h-16 w-16 rounded-full bg-white flex items-center justify-center disabled:opacity-50 ring-4 ring-white/30">
              {processing ? <Loader2 className="h-7 w-7 animate-spin text-gray-800" /> : <span className="h-12 w-12 rounded-full bg-white border-2 border-gray-800" />}
            </button>
            <button onClick={() => setSizePct(0.85)} className="text-white/80 flex flex-col items-center gap-1 text-xs w-16"><RotateCcw className="h-5 w-5" />Repor</button>
          </div>
        </>
      )}
    </div>
  );
}
