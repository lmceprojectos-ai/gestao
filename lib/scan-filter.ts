/**
 * Filtros de imagem no lado do cliente para dar às fotografias um aspeto
 * de documento digitalizado (estilo CamScanner).
 *
 * Modos disponíveis:
 *  - 'digitalizar'  : binarização adaptativa (fundo branco, texto preto e nítido)
 *  - 'cinza'        : tons de cinza simples
 *  - 'corMelhorada' : cor com balanço de brancos + contraste (documentos a cores)
 *  - 'cor'          : imagem original, sem alterações
 *
 * v2 — melhorias:
 *  - Pré-processamento com CLAHE (Contrast Limited Adaptive Histogram
 *    Equalization) local simplificado antes do threshold — levanta texto
 *    fraco/claro que antes se perdia.
 *  - Unsharp mask para nítidez em letras finas.
 *  - Sensibilidade do threshold ajustada (t=0.12 em vez de 0.15) para
 *    captar melhor texto ténue.
 *  - Função `detectDocumentBounds` exportada para enquadramento automático.
 *  - Gestão de memória: Float32Array reutilizada, arrays libertáveis.
 */

export type ScanMode = 'digitalizar' | 'cinza' | 'corMelhorada' | 'cor';

export const SCAN_MODES: { id: ScanMode; label: string }[] = [
  { id: 'digitalizar', label: 'Digitalizar' },
  { id: 'corMelhorada', label: 'Cor' },
  { id: 'cinza', label: 'Cinza' },
  { id: 'cor', label: 'Original' },
];

/**
 * Aplica o modo escolhido diretamente sobre o conteúdo de um canvas.
 */
export function applyScanMode(canvas: HTMLCanvasElement, mode: ScanMode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return;

  if (mode === 'cor') return; // sem alterações

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (mode === 'cinza') {
    toGrayscale(d);
    ctx.putImageData(imgData, 0, 0);
    return;
  }

  if (mode === 'corMelhorada') {
    enhanceColor(d);
    ctx.putImageData(imgData, 0, 0);
    return;
  }

  // 'digitalizar' — CLAHE local + unsharp + binarização adaptativa (Bradley)
  adaptiveThresholdEnhanced(d, w, h);
  ctx.putImageData(imgData, 0, 0);
}

// ---------------------------------------------------------------------------
// Grayscale
// ---------------------------------------------------------------------------
function toGrayscale(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

// ---------------------------------------------------------------------------
// Binarização adaptativa MELHORADA
// 1) Converte para cinza
// 2) Equalização local de contraste (CLAHE simplificado) — levanta texto fraco
// 3) Unsharp mask — aguza texto fino
// 4) Bradley threshold com t=0.12 (mais sensível a texto claro)
// ---------------------------------------------------------------------------
function adaptiveThresholdEnhanced(d: Uint8ClampedArray, w: number, h: number): void {
  const n = w * h;
  const gray = new Float32Array(n);

  // 1) Grayscale
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
  }

  // 2) CLAHE simplificado — equalização local de contraste por blocos
  //    (realce de texto fraco sem perder a estrutura global)
  localContrastEnhance(gray, w, h);

  // 3) Unsharp mask ligeiro (sigma ≈ 1px, amount = 0.5)
  unsharpMask(gray, w, h, 0.5);

  // 4) Imagem integral + Bradley threshold
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const yRow = y * w;
    const iRow = (y + 1) * iw;
    const iRowPrev = y * iw;
    for (let x = 0; x < w; x++) {
      rowSum += gray[yRow + x];
      integral[iRow + (x + 1)] = integral[iRowPrev + (x + 1)] + rowSum;
    }
  }

  // Janela local e sensibilidade
  const radius = Math.max(10, Math.round(Math.min(w, h) / 14));
  const t = 0.12; // mais sensível para captar texto claro

  for (let y = 0; y < h; y++) {
    const y1 = y - radius < 0 ? 0 : y - radius;
    const y2 = y + radius > h - 1 ? h - 1 : y + radius;
    for (let x = 0; x < w; x++) {
      const x1 = x - radius < 0 ? 0 : x - radius;
      const x2 = x + radius > w - 1 ? w - 1 : x + radius;
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * iw + (x2 + 1)] -
        integral[y1 * iw + (x2 + 1)] -
        integral[(y2 + 1) * iw + x1] +
        integral[y1 * iw + x1];
      const mean = sum / count;
      const idx = y * w + x;
      const val = gray[idx] < mean * (1 - t) ? 0 : 255;
      const p = idx * 4;
      d[p] = d[p + 1] = d[p + 2] = val;
    }
  }
}

/**
 * Equalização local de contraste simplificada (CLAHE-like).
 * Divide em blocos e estica o histograma localmente para que texto
 * claro ou sombras não se percam.
 */
function localContrastEnhance(gray: Float32Array, w: number, h: number): void {
  const blockSize = Math.max(32, Math.round(Math.min(w, h) / 8));
  const blocksX = Math.ceil(w / blockSize);
  const blocksY = Math.ceil(h / blockSize);

  // Para cada bloco: encontrar min/max e esticar
  for (let by = 0; by < blocksY; by++) {
    const y0 = by * blockSize;
    const y1 = Math.min(y0 + blockSize, h);
    for (let bx = 0; bx < blocksX; bx++) {
      const x0 = bx * blockSize;
      const x1 = Math.min(x0 + blockSize, w);

      // Encontrar min/max no bloco
      let mn = 255, mx = 0;
      for (let y = y0; y < y1; y++) {
        const row = y * w;
        for (let x = x0; x < x1; x++) {
          const v = gray[row + x];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }

      // Clip limit — não esticar blocos quase uniformes (evita ruído)
      const range = mx - mn;
      if (range < 10) continue;

      // Esticar para [0, 255] com clip suave
      const scale = 255 / range;
      for (let y = y0; y < y1; y++) {
        const row = y * w;
        for (let x = x0; x < x1; x++) {
          const idx = row + x;
          let v = (gray[idx] - mn) * scale;
          if (v < 0) v = 0;
          if (v > 255) v = 255;
          gray[idx] = v;
        }
      }
    }
  }
}

/**
 * Unsharp mask simples (3×3 box blur como aproximação a Gaussian).
 * Aguza texto fino e fronteiras de letras.
 */
function unsharpMask(gray: Float32Array, w: number, h: number, amount: number): void {
  const n = w * h;
  const blurred = new Float32Array(n);

  // Box blur 3×3
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += gray[ny * w + nx];
          cnt++;
        }
      }
      blurred[y * w + x] = sum / cnt;
    }
  }

  // Aplicar: original + amount * (original - blurred)
  for (let i = 0; i < n; i++) {
    let v = gray[i] + amount * (gray[i] - blurred[i]);
    if (v < 0) v = 0;
    if (v > 255) v = 255;
    gray[i] = v;
  }
}

// ---------------------------------------------------------------------------
// Realce de cor para documentos
// ---------------------------------------------------------------------------
function enhanceColor(d: Uint8ClampedArray): void {
  const n = d.length;

  // 1) Estimar ponto branco por canal (percentil ~99) via histograma
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  let px = 0;
  for (let i = 0; i < n; i += 4) {
    histR[d[i]]++;
    histG[d[i + 1]]++;
    histB[d[i + 2]]++;
    px++;
  }
  const whitePoint = (hist: Uint32Array): number => {
    const limit = px * 0.99;
    let acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= px - limit) return v > 0 ? v : 1;
    }
    return 255;
  };
  const wr = whitePoint(histR);
  const wg = whitePoint(histG);
  const wb = whitePoint(histB);
  const sr = 255 / wr;
  const sg = 255 / wg;
  const sb = 255 / wb;

  // 2) Aplicar escala (balanço de brancos) + contraste
  const contrast = 1.3;
  for (let i = 0; i < n; i += 4) {
    let r = d[i] * sr;
    let g = d[i + 1] * sg;
    let b = d[i + 2] * sb;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

// ---------------------------------------------------------------------------
// Deteção automática de bordas do documento
// ---------------------------------------------------------------------------
export interface DocBounds {
  /** Proporção [0–1] do retangulo dentro da imagem */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Deteta as bordas do documento numa imagem (via canvas element ou
 * ImageData). Devolve as proporções [0–1] do retangulo do documento.
 * Se não conseguir detetar, devolve null.
 */
export function detectDocumentBounds(imageSrc: string): Promise<DocBounds | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Redimensionar para análise rápida (máx 600px)
        const scale = Math.min(1, 600 / Math.max(img.width, img.height));
        const sw = Math.round(img.width * scale);
        const sh = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, sw, sh);

        const imgData = ctx.getImageData(0, 0, sw, sh);
        const d = imgData.data;

        // Grayscale
        const gray = new Uint8Array(sw * sh);
        for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
          gray[i] = Math.round(d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114);
        }

        // Sobel edge magnitude
        const edge = new Float32Array(sw * sh);
        for (let y = 1; y < sh - 1; y++) {
          for (let x = 1; x < sw - 1; x++) {
            const idx = y * sw + x;
            const gx =
              -gray[idx - sw - 1] + gray[idx - sw + 1] +
              -2 * gray[idx - 1] + 2 * gray[idx + 1] +
              -gray[idx + sw - 1] + gray[idx + sw + 1];
            const gy =
              -gray[idx - sw - 1] - 2 * gray[idx - sw] - gray[idx - sw + 1] +
              gray[idx + sw - 1] + 2 * gray[idx + sw] + gray[idx + sw + 1];
            edge[idx] = Math.sqrt(gx * gx + gy * gy);
          }
        }

        // Threshold para bordas fortes (percentil 85)
        const sorted = Array.from(edge).sort((a, b) => a - b);
        const threshold = sorted[Math.floor(sorted.length * 0.85)] || 30;

        // Projeções horizontal e vertical da intensidade de bordas
        const projH = new Float32Array(sh); // soma por linha
        const projV = new Float32Array(sw); // soma por coluna
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const v = edge[y * sw + x] > threshold ? 1 : 0;
            projH[y] += v;
            projV[x] += v;
          }
        }

        // Encontrar as bordas: procurar a primeira e última linha/coluna
        // com atividade significativa (>15% da dimensão)
        const hThresh = sw * 0.08;
        const vThresh = sh * 0.08;

        let top = 0, bottom = sh - 1, left = 0, right = sw - 1;

        for (let y = 0; y < sh; y++) { if (projH[y] > hThresh) { top = y; break; } }
        for (let y = sh - 1; y >= 0; y--) { if (projH[y] > hThresh) { bottom = y; break; } }
        for (let x = 0; x < sw; x++) { if (projV[x] > vThresh) { left = x; break; } }
        for (let x = sw - 1; x >= 0; x--) { if (projV[x] > vThresh) { right = x; break; } }

        // Margem de segurança (2%)
        const marginX = Math.round(sw * 0.02);
        const marginY = Math.round(sh * 0.02);
        top = Math.max(0, top - marginY);
        bottom = Math.min(sh - 1, bottom + marginY);
        left = Math.max(0, left - marginX);
        right = Math.min(sw - 1, right + marginX);

        // Só reportar se a área detetada for significativamente menor que a imagem toda
        const areaRatio = ((right - left) * (bottom - top)) / (sw * sh);
        if (areaRatio > 0.92 || areaRatio < 0.1) {
          // O documento ocupa quase toda a imagem ou a deteção falhou
          canvas.width = 1; canvas.height = 1;
          resolve(null);
          return;
        }

        // Converter para proporções [0–1]
        const bounds: DocBounds = {
          left: left / sw,
          top: top / sh,
          right: right / sw,
          bottom: bottom / sh,
        };

        canvas.width = 1; canvas.height = 1; // libertar memória
        resolve(bounds);
      } catch (e) {
        console.error('[detectDocumentBounds] erro:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}
