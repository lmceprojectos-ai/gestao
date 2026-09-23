"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Loader2, RefreshCw, Check, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// Diálogo que abre a câmara do dispositivo e permite tirar uma fotografia
// do documento, com uma moldura de enquadramento (estilo cartão de cidadão).
export function DocumentCamera({
  open,
  onOpenChange,
  onCaptured,
  title = "Fotografar documento",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCaptured: (file: File) => void;
  title?: string;
}) {
  // Proporção real do cartão de cidadão / carta de condução: 8,5 cm x 5,5 cm
  const CARD_W = 85;
  const CARD_H = 55;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const analysisRef = useRef<HTMLCanvasElement | null>(null);
  const detectRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [aligned, setAligned] = useState(false);

  // Rectângulo de recorte (em pixéis do vídeo) correspondente à moldura do cartão.
  const cropRect = useCallback((video: HTMLVideoElement) => {
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const dispW = video.clientWidth || vW;
    const dispH = video.clientHeight || vH;
    const scale = Math.max(dispW / vW, dispH / vH); // object-cover
    const offsetX = (vW * scale - dispW) / 2;
    const offsetY = (vH * scale - dispH) / 2;
    const frameW = 0.88 * dispW;
    const frameH = frameW * (CARD_H / CARD_W);
    const fx = (dispW - frameW) / 2;
    const fy = (dispH - frameH) / 2;
    return {
      sx: (fx + offsetX) / scale,
      sy: (fy + offsetY) / scale,
      sw: frameW / scale,
      sh: frameH / scale,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopDetect = useCallback(() => {
    if (detectRef.current) {
      clearInterval(detectRef.current);
      detectRef.current = null;
    }
    setAligned(false);
  }, []);

  // Deteta se o cartão está alinhado dentro da moldura, avaliando os contornos
  // (transição cartão/fundo) junto às quatro margens do retângulo.
  const analyze = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const { sx, sy, sw, sh } = cropRect(video);
    if (sw <= 0 || sh <= 0) return;
    const AW = 160;
    const AH = Math.max(1, Math.round(AW * (sh / sw)));
    let canvas = analysisRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      analysisRef.current = canvas;
    }
    canvas.width = AW;
    canvas.height = AH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, AW, AH);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, AW, AH).data;
    } catch {
      return;
    }
    const gray = new Float32Array(AW * AH);
    for (let i = 0; i < AW * AH; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    const at = (x: number, y: number) => gray[y * AW + x];
    const bandY = Math.max(2, Math.round(AH * 0.14));
    const bandX = Math.max(2, Math.round(AW * 0.1));
    let top = 0, tc = 0, bot = 0, bc = 0, left = 0, lc = 0, right = 0, rc = 0;
    for (let y = 1; y < bandY; y++) for (let x = 0; x < AW; x++) { top += Math.abs(at(x, y) - at(x, y - 1)); tc++; }
    for (let y = AH - bandY; y < AH - 1; y++) for (let x = 0; x < AW; x++) { bot += Math.abs(at(x, y + 1) - at(x, y)); bc++; }
    for (let x = 1; x < bandX; x++) for (let y = 0; y < AH; y++) { left += Math.abs(at(x, y) - at(x - 1, y)); lc++; }
    for (let x = AW - bandX; x < AW - 1; x++) for (let y = 0; y < AH; y++) { right += Math.abs(at(x + 1, y) - at(x, y)); rc++; }
    const TH = 11;
    const scores = [top / (tc || 1), bot / (bc || 1), left / (lc || 1), right / (rc || 1)];
    const strong = scores.filter((v) => v > TH).length;
    setAligned(strong >= 3);
  }, [cropRect]);

  const startDetect = useCallback(() => {
    stopDetect();
    detectRef.current = setInterval(analyze, 220);
  }, [analyze, stopDetect]);

  const stop = useCallback(() => {
    stopDetect();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopDetect]);

  const start = useCallback(async () => {
    setError(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    previewBlobRef.current = null;
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      startDetect();
    } catch {
      setError(
        "Não foi possível aceder à câmara. Autorize o acesso à câmara e utilize uma ligação segura (https)."
      );
    } finally {
      setStarting(false);
    }
  }, [preview, startDetect]);

  // Arranca/pára a câmara conforme o diálogo abre/fecha.
  useEffect(() => {
    if (open) {
      start();
    } else {
      stop();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) return;

    // Recorte exatamente sobre a moldura do cartão (8,5 cm x 5,5 cm).
    const { sx, sy, sw, sh } = cropRect(video);

    // Saída limitada para não gerar imagens grandes
    const outW = Math.min(Math.round(sw), 1024);
    const outH = Math.round(outW * (sh / sw));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        previewBlobRef.current = blob;
        setPreview(URL.createObjectURL(blob));
        stop();
      },
      "image/jpeg",
      0.9
    );
  }

  function confirm() {
    const blob = previewBlobRef.current;
    if (!blob) return;
    const file = new File([blob], `documento-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCaptured(file);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stop(); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Enquadre o documento dentro da moldura e tire a fotografia. Verifique se está legível antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[4/3]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Pré-visualização do documento" className="h-full w-full object-contain bg-black" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Moldura de enquadramento com a proporção real do cartão (8,5 x 5,5 cm) */}
                {!error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-[88%] rounded-xl border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-colors duration-200 ${
                        aligned
                          ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.4),0_0_20px_4px_rgba(52,211,153,0.6)]"
                          : "border-white/90"
                      }`}
                      style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
                    />
                    <span
                      className={`absolute bottom-3 left-0 right-0 text-center text-xs font-medium transition-colors ${
                        aligned ? "text-emerald-300" : "text-white/90"
                      }`}
                    >
                      {aligned ? "Documento alinhado — pode tirar a fotografia" : "Coloque o cartão dentro do retângulo"}
                    </span>
                  </div>
                )}
                {starting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <span className="text-sm">A iniciar a câmara...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 w-full rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <CameraOff className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {preview ? (
            <>
              <Button variant="outline" className="flex-1" onClick={start}>
                <RefreshCw className="h-4 w-4 mr-2" />Repetir
              </Button>
              <Button className="flex-1" onClick={confirm}>
                <Check className="h-4 w-4 mr-2" />Usar fotografia
              </Button>
            </>
          ) : error ? (
            <>
              <Button variant="outline" className="flex-1" onClick={start}>
                <Camera className="h-4 w-4 mr-2" />Tentar novamente
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { stop(); onOpenChange(false); }}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                className={`flex-1 ${aligned ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={capture}
                disabled={starting}
              >
                <Camera className="h-4 w-4 mr-2" />Tirar fotografia
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { stop(); onOpenChange(false); }}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
