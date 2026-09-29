// Desenho simples de PDFs A4 no próprio servidor (pdf-lib, sem serviços externos):
// texto com quebra de linha, caixas, linhas, tabelas e ligações.
// As coordenadas são medidas a partir do canto SUPERIOR esquerdo, em pontos (1 pt = 1/72").
import { PDFDocument, PDFFont, PDFPage, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';

export const A4 = { w: 595.28, h: 841.89 };

// Os tipos de letra base do PDF só têm o conjunto WinAnsi (latim + € e pontuação).
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
export function seguro(t: string): string {
  return Array.from(String(t ?? ''))
    .map((c) => {
      const n = c.codePointAt(0)!;
      if (c === '\n') return c;
      if ((n >= 32 && n <= 126) || (n >= 160 && n <= 255) || WINANSI_EXTRA.has(c)) return c;
      if (c === '\t') return ' ';
      if (c === '✓' || c === '✔') return 'v';
      return '';
    })
    .join('');
}

export function cor(hex: string) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return rgb(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255);
}

export type EstiloTexto = {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'right' | 'center';
  width?: number; // largura da caixa (para alinhar à direita/centro e quebrar linhas)
  lineHeight?: number; // em múltiplos do tamanho
};

export type Celula = { t: string; bold?: boolean; color?: string; align?: 'left' | 'right' | 'center'; link?: string; linkText?: string };
export type Coluna = { w: number; align?: 'left' | 'right' | 'center' };
export type OpcoesLinha = { size?: number; pad?: number; fill?: string; border?: string; minH?: number; bold?: boolean; color?: string };

export class Folha {
  doc!: PDFDocument;
  page!: PDFPage;
  private f!: { r: PDFFont; b: PDFFont; i: PDFFont };
  margem = 40;

  static async criar(fonte: 'helvetica' | 'courier' = 'helvetica', margem = 40): Promise<Folha> {
    const s = new Folha();
    s.margem = margem;
    s.doc = await PDFDocument.create();
    const H = fonte === 'courier'
      ? [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique]
      : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique];
    s.f = { r: await s.doc.embedFont(H[0]), b: await s.doc.embedFont(H[1]), i: await s.doc.embedFont(H[2]) };
    s.novaPagina();
    return s;
  }

  get largura() { return A4.w - 2 * this.margem; }

  novaPagina() {
    this.page = this.doc.addPage([A4.w, A4.h]);
  }

  fonte(e: { bold?: boolean; italic?: boolean } = {}) {
    return e.bold ? this.f.b : e.italic ? this.f.i : this.f.r;
  }

  medir(t: string, size: number, bold = false) {
    return this.fonte({ bold }).widthOfTextAtSize(seguro(t), size);
  }

  // Parte o texto em linhas que caibam na largura indicada.
  quebrar(t: string, size: number, maxW: number, bold = false): string[] {
    const out: string[] = [];
    for (const par of seguro(t).split('\n')) {
      let linha = '';
      for (const palavra of par.split(/\s+/).filter(Boolean)) {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (this.medir(tentativa, size, bold) <= maxW || !linha) linha = tentativa;
        else { out.push(linha); linha = palavra; }
      }
      out.push(linha);
    }
    return out;
  }

  // Escreve texto com o topo da primeira linha em y. Devolve a altura ocupada.
  texto(t: string, x: number, y: number, e: EstiloTexto = {}): number {
    const size = e.size ?? 10;
    const lh = size * (e.lineHeight ?? 1.25);
    const font = this.fonte(e);
    const linhas = e.width ? this.quebrar(t, size, e.width, e.bold) : seguro(t).split('\n');
    linhas.forEach((l, i) => {
      const w = font.widthOfTextAtSize(l, size);
      const dx = e.width && e.align === 'right' ? e.width - w : e.width && e.align === 'center' ? (e.width - w) / 2 : 0;
      this.page.drawText(l, { x: x + dx, y: A4.h - y - size * 0.8 - i * lh, size, font, color: cor(e.color ?? '#000000') });
    });
    return linhas.length * lh;
  }

  caixa(x: number, y: number, w: number, h: number, o: { fill?: string; border?: string; borderWidth?: number } = {}) {
    this.page.drawRectangle({
      x, y: A4.h - y - h, width: w, height: h,
      color: o.fill ? cor(o.fill) : undefined,
      borderColor: o.border ? cor(o.border) : undefined,
      borderWidth: o.border ? o.borderWidth ?? 0.75 : 0,
    });
  }

  linha(x1: number, y1: number, x2: number, y2: number, o: { color?: string; width?: number } = {}) {
    this.page.drawLine({ start: { x: x1, y: A4.h - y1 }, end: { x: x2, y: A4.h - y2 }, thickness: o.width ?? 0.75, color: cor(o.color ?? '#000000') });
  }

  // Zona clicável que abre um endereço.
  ligacao(x: number, y: number, w: number, h: number, url: string) {
    const annot = this.doc.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [x, A4.h - y - h, x + w, A4.h - y], Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    const ref = this.doc.context.register(annot);
    const annots = this.page.node.lookup(PDFName.of('Annots')) as any;
    if (annots) annots.push(ref);
    else this.page.node.set(PDFName.of('Annots'), this.doc.context.obj([ref]));
  }

  // Linha de tabela: desenha as células (com quebra de linha) e devolve a altura.
  private medirLinha(cols: Coluna[], cells: Celula[], o: OpcoesLinha) {
    const size = o.size ?? 9;
    const pad = o.pad ?? 4;
    const lh = size * 1.25;
    const linhas = cols.map((col, i) => {
      const c = cells[i] ?? { t: '' };
      const base = this.quebrar(c.t ?? '', size, col.w - 2 * pad, c.bold ?? o.bold);
      if (!c.link) return base;
      return [...(base.length === 1 && base[0] === '' ? [] : base), c.linkText ?? 'Ver'];
    });
    const h = Math.max(o.minH ?? 0, Math.max(...linhas.map((l) => l.length)) * lh + 2 * pad);
    return { size, pad, lh, linhas, h };
  }

  alturaLinhaTabela(cols: Coluna[], cells: Celula[], o: OpcoesLinha = {}): number {
    return this.medirLinha(cols, cells, o).h;
  }

  linhaTabela(x: number, y: number, cols: Coluna[], cells: Celula[], o: OpcoesLinha = {}): number {
    const { size, pad, lh, linhas, h } = this.medirLinha(cols, cells, o);
    let cx = x;
    cols.forEach((col, i) => {
      if (o.fill || o.border) this.caixa(cx, y, col.w, h, { fill: o.fill, border: o.border });
      const c = cells[i] ?? { t: '' };
      const align = c.align ?? col.align ?? 'left';
      const ls = linhas[i];
      ls.forEach((l, k) => {
        const eLink = !!c.link && k === ls.length - 1;
        this.texto(l, cx + pad, y + pad + k * lh, {
          size, bold: eLink || (c.bold ?? o.bold), color: eLink ? '#b45309' : c.color ?? o.color, align, width: col.w - 2 * pad,
        });
        if (eLink) this.ligacao(cx + pad, y + pad + k * lh, this.medir(l, size, true), lh, c.link!);
      });
      cx += col.w;
    });
    return h;
  }

  async guardar(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}
