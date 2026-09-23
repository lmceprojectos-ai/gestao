export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { iaConfigurada, perguntarIA } from '@/lib/ai';
import * as XLSX from 'xlsx';

// Convert a single XLSX cell into a string, choosing the right source per type:
//  - Date cells (t:'d'): use the underlying Date value serialised to ISO
//    YYYY-MM-DD (UTC components). The cached formatted text `.w` would be the
//    US locale (e.g. "7/13/26") which the client mis-reads as DD/MM.
//  - Everything else (numbers, strings): use the formatted text `.w` when
//    available. For numbers this preserves the ORIGINAL Portuguese formatting
//    (e.g. "-185,46"); the raw numeric value `.v` can be wrong because XLSX
//    coerces locale-formatted TSV numbers with US conventions ("-185,46" -> -18546).
function cellToString(cell: any): string {
  if (!cell) return '';
  if (cell.t === 'd' && cell.v instanceof Date && !isNaN(cell.v.getTime())) {
    const d = cell.v as Date;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  if (cell.w !== undefined && cell.w !== null) return String(cell.w);
  return cell.v !== undefined && cell.v !== null ? String(cell.v) : '';
}

// Build a 2D matrix of strings from a worksheet, reading each cell object
// directly so cellToString() can pick the correct representation per type.
function sheetToMatrix(sheet: any): string[][] {
  if (!sheet || !sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const out: string[][] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: string[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      row.push(cellToString(sheet[XLSX.utils.encode_cell({ r: R, c: C })]));
    }
    out.push(row);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let rows: Array<Record<string, string>> = [];
    let accountHints: { iban: string | null; numbers: string[] } = { iban: null, numbers: [] };

    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      // Parse CSV - decode with encoding detection (many PT banks export in Latin-1 / Windows-1252)
      const buffer = await file.arrayBuffer();
      const text = decodeText(buffer);
      accountHints = extractAccountHints(text);
      rows = parseCSV(text);
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm')) {
      // Parse Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        return NextResponse.json({ error: 'Ficheiro Excel vazio' }, { status: 400 });
      }

      // Read the sheet cell-by-cell so we can normalise dates to ISO while
      // preserving the original Portuguese number formatting (see cellToString).
      const jsonData = sheetToMatrix(firstSheet);

      if (jsonData.length < 2) {
        return NextResponse.json({ error: 'Ficheiro sem dados suficientes' }, { status: 400 });
      }

      // Find the actual header row (some banks like Montepio have info rows before the data)
      // Look for the row that contains typical column headers
      // Pick the row with the MOST header-keyword matches (not the first row that
      // merely has >= 2). Some Montepio exports include a metadata row like
      // "Nome 1º Titular | Movimentos | Data/hora Consulta" that has 2 keyword
      // hits ('mov' + 'data') but is NOT the real header. The true header row
      // ("DATA MOV. | DATA VALOR | DESCRIÇÃO | IMPORTÂNCIA | SALDO ...") scores
      // higher, so best-score selection is robust across statement layouts.
      let headerRowIdx = 0;
      let bestHeaderScore = -1;
      const headerKeywords = ['data', 'descri', 'débito', 'debito', 'crédito', 'credito', 'valor', 'saldo', 'montante', 'histórico', 'historico', 'mov'];
      
      for (let i = 0; i < Math.min(jsonData.length, 40); i++) {
        const rowVals = jsonData[i] as any[];
        if (!rowVals || rowVals.length < 2) continue;
        const rowText = rowVals.map((v: any) => String(v || '').toLowerCase()).join(' ');
        const matches = headerKeywords.filter(kw => rowText.includes(kw)).length;
        if (matches >= 2 && matches > bestHeaderScore) {
          bestHeaderScore = matches;
          headerRowIdx = i;
        }
      }

      // Extract account identifiers from the metadata rows above the header
      const metaText = jsonData.slice(0, headerRowIdx + 1)
        .map((r: any[]) => (Array.isArray(r) ? r.map((v) => String(v ?? '')).join(' ') : ''))
        .join('\n');
      accountHints = extractAccountHints(metaText);

      const headers = (jsonData[headerRowIdx] as any[]).map((h: any) => 
        String(h || '').trim().toLowerCase()
      ).filter(h => h !== '');

      // Remaining rows are data
      for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
        const vals = jsonData[i] as any[];
        if (!vals || vals.length === 0) continue;
        
        // Skip rows that are completely empty
        const hasData = vals.some((v: any) => v !== undefined && v !== null && String(v).trim() !== '');
        if (!hasData) continue;

        const row: Record<string, string> = {};
        headers.forEach((h: string, idx: number) => {
          const val = vals[idx];
          row[h] = val !== undefined && val !== null ? String(val) : '';
        });
        rows.push(row);
      }
    } else if (fileName.endsWith('.pdf')) {
      // Parse PDF using LLM API
      if (!iaConfigurada()) {
        return NextResponse.json({ error: 'API key não configurada para processar PDF' }, { status: 500 });
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const prompt = `Analisa este extrato bancário em PDF e extrai TODOS os movimentos/transações.
Devolve APENAS um JSON com a seguinte estrutura:
{
  "movimentos": [
    {
      "data": "DD/MM/YYYY",
      "descricao": "descrição do movimento",
      "debito": "valor débito ou vazio",
      "credito": "valor crédito ou vazio",
      "saldo": "saldo após movimento ou vazio"
    }
  ]
}

Regras:
- Extrai TODOS os movimentos, não apenas alguns
- Usa o formato DD/MM/YYYY para as datas
- Para valores, usa o formato português (ex: 1.234,56)
- Se o extrato usar coluna única de valor: positivo vai para "credito", negativo (sem sinal) vai para "debito"
- Se não conseguires identificar débito/crédito separadamente, coloca o valor na coluna apropriada baseado no contexto
- Ignora linhas de cabeçalho, totais, ou informações da conta
- Devolve APENAS o JSON, sem texto adicional`;

      let content: string;
      try {
        content = await perguntarIA({ prompt, anexos: [{ tipo: 'pdf', base64 }], maxTokens: 64000 });
      } catch (e: any) {
        console.error('LLM API error for PDF:', e?.message);
        return NextResponse.json(
          { error: `Erro ao processar o PDF no serviço de IA: ${e?.message || 'erro desconhecido'}` },
          { status: 502 },
        );
      }

      let parsed: any = extractJsonObject(content);
      if (!parsed) {
        console.error('Could not parse PDF LLM response:', content.slice(0, 1000));
        return NextResponse.json(
          { error: 'Não foi possível interpretar a resposta da IA para este extrato PDF. O ficheiro pode ser demasiado extenso ou ter um formato invulgar.' },
          { status: 422 },
        );
      }

      const movimentos = parsed?.movimentos || parsed?.transactions || [];
      if (!Array.isArray(movimentos) || movimentos.length === 0) {
        return NextResponse.json({ error: 'Não foram encontrados movimentos no PDF' }, { status: 400 });
      }

      // Convert to standard row format
      rows = movimentos.map((m: any) => ({
        data: String(m.data || ''),
        descrição: String(m.descricao || m.descrição || ''),
        débito: String(m.debito || m.débito || ''),
        crédito: String(m.credito || m.crédito || ''),
        saldo: String(m.saldo || ''),
      }));
    } else {
      return NextResponse.json({ error: 'Formato não suportado. Use CSV, XLS, XLSX ou PDF.' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Ficheiro vazio ou sem dados válidos' }, { status: 400 });
    }

    // Detect columns
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const detected = detectColumns(columns);

    return NextResponse.json({
      success: true,
      rows,
      columns,
      detected,
      accountHints,
      totalRows: rows.length,
    });
  } catch (error: any) {
    console.error('Parse file error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar ficheiro' }, { status: 500 });
  }
}

// Decode a file buffer trying UTF-8 first, falling back to Windows-1252 (Latin-1)
// which is what most Portuguese banks (CGD, Montepio, etc.) use for CSV exports.
function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Strip UTF-8 BOM if present
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return new TextDecoder('latin1').decode(bytes);
    }
  }
}

// Extract bank-account identifiers (IBAN and domestic account numbers) from the
// metadata that PT banks include in statement exports. Used to auto-match the
// destination account by comparing against the stored IBAN of each account.
function extractAccountHints(text: string): { iban: string | null; numbers: string[] } {
  if (!text) return { iban: null, numbers: [] };
  // IBAN: PT + 2 check digits + 21 digits, possibly spaced/grouped
  let iban: string | null = null;
  const ibanMatch = text.replace(/\u00A0/g, ' ').match(/PT\s*\d{2}(?:[\s.]*\d){21}/i);
  if (ibanMatch) {
    const digits = ibanMatch[0].replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (digits.length >= 20) iban = digits;
  }
  // Domestic account numbers: contiguous runs of >= 8 digits (excludes dates,
  // amounts and short codes). NIFs (9 digits) may appear but are harmless.
  const numbers = new Set<string>((text.match(/\d{8,}/g) || []));
  // Also capture account numbers written with separators (e.g. Montepio
  // "014.10.008398-0"). Strip separators and keep runs of >= 10 digits so that
  // dates like 2026-04-01 (8 digits once stripped) are not misread as accounts.
  const sepTokens = text.match(/\d{2,}(?:[.\-/]\d{2,})+/g) || [];
  for (const tok of sepTokens) {
    const d = tok.replace(/\D/g, '');
    if (d.length >= 10) numbers.add(d);
  }
  return { iban, numbers: Array.from(numbers) };
}

function parseCSV(text: string): Array<Record<string, string>> {
  const allLines = text.split(/\r?\n/);
  if (allLines.length < 2) return [];

  // Detect separator from the line that most looks like tabular data
  const detectSep = (line: string): string => {
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    if (line.includes(',')) return ',';
    return ';';
  };

  // Find the real header row. Many PT banks (CGD, Montepio) prepend several
  // metadata rows (account info, balances, period) before the movements table.
  const headerKeywords = ['data', 'descri', 'débito', 'debito', 'crédito', 'credito', 'valor', 'saldo', 'montante', 'histórico', 'historico', 'mov'];
  let headerIdx = 0;
  let headerSep = ';';
  let bestScore = -1;
  for (let i = 0; i < Math.min(allLines.length, 30); i++) {
    const line = allLines[i];
    if (!line || !line.trim()) continue;
    const sep = detectSep(line);
    const cells = line.split(sep).map((c) => c.trim().toLowerCase());
    if (cells.filter((c) => c !== '').length < 2) continue;
    const score = headerKeywords.filter((kw) => cells.some((c) => c.includes(kw))).length;
    if (score >= 2 && score > bestScore) {
      bestScore = score;
      headerIdx = i;
      headerSep = sep;
    }
  }
  // Fallback: if no header found, use the first non-empty line
  if (bestScore < 0) {
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i] && allLines[i].trim()) { headerIdx = i; headerSep = detectSep(allLines[i]); break; }
    }
  }

  const sep = headerSep;
  const rawHeaders = allLines[headerIdx].split(sep).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  // Keep header positions but drop trailing empty header names
  const headers = rawHeaders.map((h, idx) => h || `col_${idx}`);
  const rows: Array<Record<string, string>> = [];

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line || !line.trim()) continue;

    const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));

    // Skip empty rows
    const hasData = vals.some((v) => v !== '');
    if (!hasData) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      // Ignore auto-generated empty column names
      if (h.startsWith('col_') && !(vals[idx] && vals[idx] !== '')) return;
      row[h] = vals[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

function detectColumns(keys: string[]) {
  // Common PT bank CSV/XLS column names (Montepio, CGD, BPI, Millennium, Novo Banco, etc.)
  const datePatterns = ['data mov', 'data movimento', 'data valor', 'data operação', 'data operacao', 'dt mov', 'dt. mov', 'data lanc', 'data lançamento', 'dt. valor', 'dt.valor', 'data oper.', 'data oper', 'date'];
  const descPatterns = ['descrição', 'descricao', 'description', 'descritivo', 'histórico', 'historico', 'descrição do movimento', 'desc. movimento', 'observações', 'obs'];
  const debitPatterns = ['débito', 'debito', 'debit', 'valor débito', 'valor debito', 'montante débito', 'saída', 'saida', 'valor a débito', 'val. débito', 'importância a débito'];
  const creditPatterns = ['crédito', 'credito', 'credit', 'valor crédito', 'valor credito', 'montante crédito', 'entrada', 'valor a crédito', 'val. crédito', 'importância a crédito'];
  const valorPatterns = ['montante', 'amount', 'importancia', 'importância'];

  // Exact match first, then partial match
  const findExact = (patterns: string[]) => keys.find((k) => patterns.includes(k));
  const findPartial = (patterns: string[]) => keys.find((k) => patterns.some((p) => k.includes(p)));

  // For 'data': prefer the movement/posting date over the value date, since the
  // value date (data-valor) can fall in the previous month for some movements.
  const dataCol =
    keys.find((k) => k.includes('data mov') || k.includes('dt mov') || k.includes('data lanc') || k.includes('data lançamento') || k.includes('data oper')) ||
    findExact(datePatterns) || findPartial(datePatterns) || findExact(['data']) ||
    keys.find((k) => k.includes('data')) || '';
  const descCol = findExact(descPatterns) || findPartial(descPatterns) || '';
  
  // For debit/credit, prefer exact matches to avoid matching 'saldo' or other columns
  const debitCol = findExact(debitPatterns) || findPartial(debitPatterns) || '';
  const creditCol = findExact(creditPatterns) || findPartial(creditPatterns) || '';
  
  // Only use 'valor' pattern if no debit/credit columns were found
  const valorCol = (!debitCol && !creditCol) ? (findExact(valorPatterns) || findPartial(valorPatterns) || findExact(['valor']) || '') : '';

  return {
    data: dataCol,
    descricao: descCol,
    debito: debitCol,
    credito: creditCol,
    valor: valorCol,
  };
}

// Robustly extract a JSON object from an LLM text response. Handles: raw JSON,
// JSON wrapped in ```json fences, and JSON preceded/followed by prose. Falls
// back to a balanced-brace scan so a truncated tail does not defeat parsing of
// the leading object.
function extractJsonObject(raw: string): any | null {
  if (!raw) return null;
  let text = String(raw).trim();
  // Strip markdown code fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // 1) Direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // 2) Balanced-brace scan from the first '{'
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          break;
        }
      }
    }
  }

  // 3) Last resort: greedy match then progressively trim trailing chars
  const greedy = text.slice(start);
  for (let end = greedy.length; end > 1; end--) {
    const candidate = greedy.slice(0, end);
    if (!candidate.trimEnd().endsWith('}')) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}
