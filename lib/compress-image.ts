/**
 * Compress an image file client-side using Canvas API.
 * Reduces quality and max dimensions to save storage space.
 * Returns original file if not an image or if compression fails.
 *
 * v2 — melhorias:
 * - Resolução máxima aumentada para 2400px (melhor digitalização)
 * - Qualidade JPEG aumentada para 0.82
 * - Gestão de memória: tenta resolução alta, faz fallback se o browser
 *   ficar sem memória (catch no toBlob / getImageData)
 * - Liberta recursos (URL, canvas) agressivamente
 */

const TIERS = [
  { max: 2400, q: 0.82 },  // Alta — ideal para digitalização
  { max: 1800, q: 0.78 },  // Média — fallback se memória estiver curta
  { max: 1200, q: 0.72 },  // Baixa — último recurso
];

export async function compressImage(
  file: File,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;

  // Se o caller passou dimensões explícitas, usar diretamente (mantém API anterior)
  if (maxWidth != null || maxHeight != null || quality != null) {
    return compressSingle(file, maxWidth ?? 2400, maxHeight ?? 2400, quality ?? 0.82);
  }

  // Tentar os tiers por ordem decrescente de qualidade
  for (const tier of TIERS) {
    try {
      return await compressSingle(file, tier.max, tier.max, tier.q);
    } catch (e: any) {
      console.warn(`[compressImage] tier ${tier.max}px falhou — a tentar resolução inferior`, e?.message);
      // Continuar para o tier seguinte
    }
  }

  // Todos os tiers falharam — devolver original
  console.warn('[compressImage] todas as resoluções falharam, a devolver o ficheiro original');
  return file;
}

function compressSingle(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Só redimensionar se maior que os limites
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Se a imagem já cabe e o ficheiro é pequeno, saltar
      if (width === img.width && height === img.height && file.size < 600 * 1024) {
        resolve(file);
        return;
      }

      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            // Limpar canvas para libertar memória
            if (canvas) { canvas.width = 1; canvas.height = 1; }
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          quality,
        );
      } catch (e) {
        // Canvas allocation failed (memória insuficiente)
        if (canvas) { canvas.width = 1; canvas.height = 1; }
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
