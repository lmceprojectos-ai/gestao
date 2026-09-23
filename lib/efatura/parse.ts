// Leitura do Excel exportado do e-Fatura (Portal das Finanças → Faturas de aquisição).
// Colunas: Setor | Emitente | Nº Fatura / ATCUD | Tipo | Data Emissão | Total | IVA | Base Tributável | [Situação]
import * as XLSX from 'xlsx';

export type LinhaEFatura = {
  setor: string | null;
  emitenteNif: string;
  emitenteNome: string;
  numero: string;
  atcud: string | null;
  tipo: string;
  dataEmissao: string; // YYYY-MM-DD
  total: number;
  iva: number | null;
  base: number | null;
  situacao: string | null;
};

// Valores chegam como número ou como texto PT ("1.075,91 €").
export function parseValor(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v).replace(/€/g, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseData(v: unknown): string | null {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // DD/MM/AAAA
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export function parseEFatura(buffer: Buffer): { linhas: LinhaEFatura[]; ignoradas: number } {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const hIdx = rows.findIndex((r) => r.some((c) => norm(c) === 'emitente'));
  if (hIdx === -1) throw new Error('Ficheiro não reconhecido: falta a coluna "Emitente" do e-Fatura.');
  const header = rows[hIdx].map(norm);
  const col = (...nomes: string[]) => header.findIndex((h) => nomes.some((n) => h.startsWith(n)));
  const c = {
    setor: col('setor'),
    emitente: col('emitente'),
    numero: col('no fatura', 'nº fatura', 'n.º fatura'),
    tipo: col('tipo'),
    data: col('data emissao', 'data'),
    total: col('total'),
    iva: col('iva'),
    base: col('base tributavel', 'base'),
    situacao: col('situacao'),
  };
  if (c.emitente < 0 || c.numero < 0 || c.total < 0 || c.data < 0) {
    throw new Error('Ficheiro não reconhecido: faltam colunas do e-Fatura (Emitente, Nº Fatura, Data, Total).');
  }

  const linhas: LinhaEFatura[] = [];
  let ignoradas = 0;
  for (const r of rows.slice(hIdx + 1)) {
    if (!r || r.every((v) => v === null || v === '')) continue;
    const emitente = String(r[c.emitente] ?? '').trim();
    const numAtcud = String(r[c.numero] ?? '').trim();
    const data = parseData(r[c.data]);
    const total = parseValor(r[c.total]);
    if (!emitente || !numAtcud || !data || total === null) {
      ignoradas++;
      continue;
    }
    // "503555690 - Dimatur ..." → NIF + nome
    const em = emitente.match(/^(\d{9})\s*-\s*(.+)$/);
    // "FT 2026A1/59461 / J6TKZ3SB-59461" → número + ATCUD (o número também tem "/", mas sem espaços)
    const sep = numAtcud.lastIndexOf(' / ');
    linhas.push({
      setor: c.setor >= 0 ? String(r[c.setor] ?? '').trim() || null : null,
      emitenteNif: em ? em[1] : '',
      emitenteNome: em ? em[2].trim() : emitente,
      numero: sep > 0 ? numAtcud.slice(0, sep).trim() : numAtcud,
      atcud: sep > 0 ? numAtcud.slice(sep + 3).trim() || null : null,
      tipo: c.tipo >= 0 ? String(r[c.tipo] ?? '').trim() : 'Fatura',
      dataEmissao: data,
      total,
      iva: c.iva >= 0 ? parseValor(r[c.iva]) : null,
      base: c.base >= 0 ? parseValor(r[c.base]) : null,
      situacao: c.situacao >= 0 ? String(r[c.situacao] ?? '').trim() || null : null,
    });
  }
  return { linhas, ignoradas };
}
