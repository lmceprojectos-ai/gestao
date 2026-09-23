import { PDFDocument } from 'pdf-lib';

export interface SplitPage {
  blob: Blob;
  name: string;
  pageNumber: number;
}

/**
 * Conta o número de páginas de um ficheiro PDF (lado do cliente).
 * Não interpreta o conteúdo — apenas a estrutura do documento.
 */
export async function getPdfPageCount(file: File | Blob): Promise<number> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Divide um PDF de várias páginas em PDFs individuais de 1 página cada.
 * Cada página passa a ser um PDF separado (uma fatura por página).
 */
export async function splitPdfIntoPages(file: File, baseName?: string): Promise<SplitPage[]> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const base = (baseName || file.name || 'documento').replace(/\.pdf$/i, '');
  const pages: SplitPage[] = [];
  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [copied] = await out.copyPages(src, [i]);
    out.addPage(copied);
    const outBytes = await out.save();
    const blob = new Blob([outBytes as any], { type: 'application/pdf' });
    pages.push({
      blob,
      name: `${base}_fatura_${String(i + 1).padStart(2, '0')}.pdf`,
      pageNumber: i + 1,
    });
  }
  return pages;
}
