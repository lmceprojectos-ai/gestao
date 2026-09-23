'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, ScanLine, Focus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { applyScanMode, SCAN_MODES, ScanMode, detectDocumentBounds } from '@/lib/scan-filter';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
  fileName?: string;
  /** Rácio de aspeto do recorte. Por defeito A4 (210/297). Para cartões use ~1.586. */
  aspect?: number;
  /** Título apresentado no cabeçalho do modal. */
  title?: string;
}

/**
 * Recorta a imagem na área selecionada e aplica o filtro de digitalização.
 * v2: Melhores resoluções — o canvas de saída usa escala 1.5× (até 3600px)
 * com fallback se ficar sem memória. Qualidade JPEG 0.93.
 */
function getCroppedImg(imageSrc: string, pixelCrop: CropArea, mode: ScanMode): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      // Tentar escala superior para melhor resolução, fallback se falhar
      const scales = [1.5, 1.0];
      let lastErr: Error | null = null;

      const tryScale = (idx: number) => {
        if (idx >= scales.length) {
          reject(lastErr || new Error('Falha ao processar imagem'));
          return;
        }
        const s = scales[idx];
        const outW = Math.round(pixelCrop.width * s);
        const outH = Math.round(pixelCrop.height * s);

        // Limitar a 3600px de lado para não rebentar a memória
        const maxSide = 3600;
        const finalScale = Math.min(1, maxSide / Math.max(outW, outH));
        const fw = Math.round(outW * finalScale);
        const fh = Math.round(outH * finalScale);

        let canvas: HTMLCanvasElement | null = null;
        try {
          canvas = document.createElement('canvas');
          canvas.width = fw;
          canvas.height = fh;
          const ctx = canvas.getContext('2d');
          if (!ctx) { tryScale(idx + 1); return; }

          ctx.drawImage(
            image,
            pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
            0, 0, fw, fh
          );

          // Aplicar o efeito de digitalização escolhido
          try {
            applyScanMode(canvas, mode);
          } catch (e) {
            console.warn('[getCroppedImg] scan filter falhou, a usar imagem sem filtro', e);
          }

          canvas.toBlob(
            (blob) => {
              // Libertar memória do canvas
              if (canvas) { canvas.width = 1; canvas.height = 1; }
              if (blob) {
                resolve(blob);
              } else {
                lastErr = new Error('Canvas toBlob failed');
                tryScale(idx + 1);
              }
            },
            'image/jpeg',
            0.93
          );
        } catch (e: any) {
          console.warn(`[getCroppedImg] escala ${s}x falhou:`, e?.message);
          if (canvas) { canvas.width = 1; canvas.height = 1; }
          lastErr = e;
          tryScale(idx + 1);
        }
      };

      tryScale(0);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

export function ImageCropModal({ imageSrc, onConfirm, onCancel, fileName, aspect = 210 / 297, title }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [processing, setProcessing] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  // Por defeito, mostra a imagem ORIGINAL. O utilizador escolhe se quer digitalizar.
  const [mode, setMode] = useState<ScanMode>('cor');
  // Guardar dimensões naturais da imagem para calcular zoom/crop do auto-detect
  const imgSize = useRef<{ w: number; h: number } | null>(null);
  const autoDetectRan = useRef(false);

  const onCropComplete = useCallback((_: any, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // Carregar dimensões da imagem e executar auto-detect na montagem
  useEffect(() => {
    if (autoDetectRan.current) return;
    autoDetectRan.current = true;

    const img = new window.Image();
    img.onload = () => {
      imgSize.current = { w: img.width, h: img.height };
      // Executar enquadramento automático
      runAutoDetect();
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  const runAutoDetect = async () => {
    setAutoDetecting(true);
    try {
      const bounds = await detectDocumentBounds(imageSrc);
      if (!bounds || !imgSize.current) {
        setAutoDetecting(false);
        return;
      }

      // A área do documento em proporções [0-1]
      const docW = bounds.right - bounds.left;
      const docH = bounds.bottom - bounds.top;
      const docCenterX = bounds.left + docW / 2;
      const docCenterY = bounds.top + docH / 2;

      // O aspect ratio do cropper (A4 por defeito, ou cartão)
      const cropAspect = aspect;

      // Calcular o zoom necessário para enquadrar o documento
      // O cropper mostra uma janela com o aspect ratio fixo
      // O zoom 1 mostra a imagem inteira (fit)
      // Precisamos calcular quanto zoom para que a janela cubra a área do documento

      const imgAspect = imgSize.current.w / imgSize.current.h;

      // A janela visível no zoom=1 cobre:
      let visW: number, visH: number;
      if (imgAspect > cropAspect) {
        // Imagem mais larga que a janela → altura inteira, largura parcial
        visH = 1;
        visW = cropAspect / imgAspect;
      } else {
        // Imagem mais alta → largura inteira, altura parcial
        visW = 1;
        visH = imgAspect / cropAspect;
      }

      // Zoom = visível / documento (limitado entre 1 e 2.5)
      const zoomNeeded = Math.min(2.5, Math.max(1, Math.min(visW / docW, visH / docH) * 0.92));

      // Calcular deslocamento do crop (em pixels do container)
      // O react-easy-crop usa {x, y} como offset do centro da imagem
      // relativamente ao centro da janela. Unidades: pixels do container.
      // Quando zoom > 1, um offset de N pixels desloca N pixels na imagem escalada.

      // O deslocamento necessário: mover o centro do documento para o centro da janela
      // Em proporção da imagem: desvio = (0.5 - docCenter) * tamanho_imagem_escalada
      // Na prática, react-easy-crop espera offset em pixels relativos ao container,
      // mas escalados pelo zoom. Uma boa aproximação:
      const offsetX = (0.5 - docCenterX) * imgSize.current.w * (zoomNeeded > 1 ? 0.3 : 0);
      const offsetY = (0.5 - docCenterY) * imgSize.current.h * (zoomNeeded > 1 ? 0.3 : 0);

      setZoom(zoomNeeded);
      setCrop({ x: offsetX, y: offsetY });
    } catch (e) {
      console.warn('[auto-detect] erro:', e);
    } finally {
      setAutoDetecting(false);
    }
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, mode);
      onConfirm(croppedBlob);
    } catch (err: any) {
      console.error('Crop error:', err);
      // Mostrar feedback ao utilizador
      alert('Erro ao processar a imagem. Tente com uma foto de menor resolução.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-[60] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/50">
          <button onClick={onCancel} className="text-white flex items-center gap-1 text-sm hover:text-gray-300">
            <X className="h-5 w-5" />Cancelar
          </button>
          <span className="text-white text-sm font-medium flex items-center gap-1.5">
            <ScanLine className="h-4 w-4" />{title || 'Digitalizar documento'}
          </span>
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="text-white flex items-center gap-1 text-sm font-semibold bg-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />A processar...</>
            ) : (
              <><Check className="h-4 w-4" />Confirmar</>
            )}
          </button>
        </div>

        {/* Auto-detect indicator */}
        {autoDetecting && (
          <div className="flex items-center justify-center gap-2 py-1.5 bg-amber-600/80 text-white text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            A enquadrar o documento automaticamente…
          </div>
        )}

        {/* Crop area */}
        <div className="relative flex-1">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#000' },
            }}
          />
        </div>

        {/* Filtros de digitalização */}
        <div className="flex items-center justify-center gap-2 px-3 pt-3 bg-black/50 flex-wrap">
          {SCAN_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                mode === m.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/10 text-gray-200 hover:bg-white/20'
              }`}
            >
              {m.label}
            </button>
          ))}
          {/* Botão de enquadrar */}
          <button
            onClick={runAutoDetect}
            disabled={autoDetecting}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-gray-200 hover:bg-white/20 transition-colors flex items-center gap-1 disabled:opacity-50"
            title="Enquadrar automaticamente"
          >
            {autoDetecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Focus className="h-3.5 w-3.5" />}
            Enquadrar
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 p-3 bg-black/50">
          <button onClick={() => setZoom(Math.max(1, zoom - 0.2))} className="text-white p-2 rounded-full hover:bg-white/10">
            <ZoomOut className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-32 accent-amber-500"
          />
          <button onClick={() => setZoom(Math.min(3, zoom + 0.2))} className="text-white p-2 rounded-full hover:bg-white/10">
            <ZoomIn className="h-5 w-5" />
          </button>
          <button onClick={handleReset} className="text-white p-2 rounded-full hover:bg-white/10" title="Repor">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
