'use client';

import { useState, useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize } from 'lucide-react';

/**
 * Pré-visualização de documentos.
 * - Imagens (jpg/png/gif/webp/heic/…): mostradas com controlos de zoom, rotação e
 *   arrastar (pan) para ver os detalhes ao pormenor.
 * - PDF e outros: mostrados num iframe.
 * A deteção do tipo usa o contentType (quando fornecido) e, em alternativa,
 *   a extensão do URL (ignorando a query string das URLs assinadas).
 */
export function FilePreviewFrame({
  url,
  className = 'w-full h-[70vh] rounded-lg border',
  alt = 'Documento',
  contentType,
}: {
  url: string;
  className?: string;
  alt?: string;
  contentType?: string;
}) {
  const semQuery = (url || '').split('?')[0].toLowerCase();
  const ext = semQuery.split('.').pop() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'avif'];
  const ct = (contentType || '').toLowerCase();
  const isImagem = ct.startsWith('image/') || (!ct && imageExts.includes(ext)) || imageExts.includes(ext);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });

  const reset = useCallback(() => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); }, []);
  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.5, 6)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.5, 1)), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!isImagem) return;
    e.preventDefault();
    setZoom((z) => Math.min(6, Math.max(1, z + (e.deltaY < 0 ? 0.3 : -0.3))));
  }, [isImagem]);

  const onMouseDown = (e: ReactMouseEvent) => {
    if (zoom <= 1) return;
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragState.current.dragging) return;
    setOffset({
      x: dragState.current.baseX + (e.clientX - dragState.current.startX),
      y: dragState.current.baseY + (e.clientY - dragState.current.startY),
    });
  };
  const endDrag = () => { dragState.current.dragging = false; };

  if (isImagem) {
    return (
      <div className={`${className} relative bg-muted/40 overflow-hidden`}>
        {/* Controlos de zoom */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-background/90 border border-border p-1 shadow-sm">
          <button type="button" onClick={zoomOut} disabled={zoom <= 1} title="Reduzir" className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs font-medium tabular-nums w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} disabled={zoom >= 6} title="Ampliar" className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rodar" className="p-1.5 rounded-md hover:bg-muted"><RotateCw className="h-4 w-4" /></button>
          <button type="button" onClick={reset} title="Repor" className="p-1.5 rounded-md hover:bg-muted"><Maximize className="h-4 w-4" /></button>
        </div>
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ cursor: zoom > 1 ? (dragState.current.dragging ? 'grabbing' : 'grab') : 'default' }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onDoubleClick={() => (zoom > 1 ? reset() : zoomIn())}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none transition-transform duration-100"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)` }}
          />
        </div>
      </div>
    );
  }
  return <iframe src={url} className={className} title={alt} />;
}
