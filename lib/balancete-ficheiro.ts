// Leitura de ficheiros para o Balancete (Excel .xlsx/.xls ou .csv).
//
// 1) Ficheiro no formato do BALANCETE KREACONCENSUS (folhas "Despesas Q1..Q4",
//    "Receitas Q1..Q4" e "Mov. Internos"): cada linha vai para o sítio da folha
//    onde está. As despesas ficam sempre negativas e as receitas positivas, seja
//    qual for o sinal escrito no Excel (no ficheiro há trimestres com as despesas
//    positivas e outros com as despesas negativas).
// 2) Qualquer outro ficheiro com colunas Data / Valor / Descrição (ex.: o extrato
//    de um trimestre): é o sinal do valor que decide — negativo é despesa,
//    positivo é receita. O trimestre sai da data.
//
// Movimentos internos: "origem → destino" dá duas linhas (sai da origem, entra no
// destino); sem origem (ex.: "TRÂNSITO SALDO 2024") é o saldo que entra na conta.
import * as XLSX from 'xlsx';
import { trimestreDe } from '@/lib/balancete';

export type MovimentoLido = {
  data: Date;
  valor: number;
  descricao: string;
  metodo: string | null;
  conta: string;
  categoria: string | null;
  subcategoria: string | null;
  fiscal: string | null;
  tipo: 'RECEITA' | 'DESPESA' | 'INTERNO';
  trimestre: string;
  origem: string | null;
  destino: string | null;
  nota: string | null;
};

export type Leitura = {
  formato: 'balancete' | 'extrato';
  movimentos: MovimentoLido[];
  listas: { grupo: string; nome: string }[];
  avisos: string[];
};

const MESES: Record<string, number> = {
  jan: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, may: 4, mai: 4, jun: 5, jul: 6,
  aug: 7, ago: 7, sep: 8, set: 8, oct: 9, out: 9, nov: 10, dec: 11, dez: 11,
};

// "12Jan2026", "2025-05-23", "23/05/2025", número de série do Excel ou Date.
export function lerData(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(Date.UTC(d.y, d.m - 1, d.d)) : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?\s*(\d{4})$/);
  if (m && MESES[m[2].toLowerCase()] != null) return new Date(Date.UTC(+m[3], MESES[m[2].toLowerCase()], +m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

// "1,234.56 €", "-2.343,50", "1 234,56", 12.5
export function lerValor(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[€\s ]/g, '');
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '');
  const ultVirgula = s.lastIndexOf(','), ultPonto = s.lastIndexOf('.');
  if (ultVirgula > ultPonto) s = s.replace(/\./g, '').replace(',', '.'); // formato português
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

const limpo = (v: unknown) => {
  const s = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  return s || null;
};

// Nomes de contas como no balancete (Gerente → GERENTE, MONTEPIO → Montepio…).
const CONTAS: Record<string, string> = { montepio: 'Montepio', cgd: 'CGD', 'caixa geral': 'CGD', cash: 'Cash', caixa: 'Cash', 'sócia': 'Sócia', socia: 'Sócia', gerente: 'GERENTE' };
export function nomeConta(v: unknown, contasExistentes: string[] = []) {
  const s = limpo(v);
  if (!s) return null;
  const existente = contasExistentes.find((c) => c.toLowerCase() === s.toLowerCase());
  return existente ?? CONTAS[s.toLowerCase()] ?? s;
}

// Uma data no futuro só pode ser gralha no ano (ex.: 10Nov2026 num ficheiro de 2025).
function corrigirFuturo(d: Date, avisos: string[], onde: string): { data: Date; nota: string | null } {
  const hoje = new Date();
  if (d.getTime() <= hoje.getTime()) return { data: d, nota: null };
  const corrigida = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
  const txt = (x: Date) => x.toISOString().slice(0, 10);
  avisos.push(`${onde}: data ${txt(d)} está no futuro — importada como ${txt(corrigida)}`);
  return { data: corrigida, nota: `Data corrigida (no ficheiro: ${txt(d)})` };
}

function linhas(ws: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
}

export function lerFicheiroBalancete(buffer: Buffer, contaPorDefeito: string | null, contasExistentes: string[] = []): Leitura {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const avisos: string[] = [];
  const movimentos: MovimentoLido[] = [];
  const conta = (v: unknown) => nomeConta(v, contasExistentes);

  const folhasQ = wb.SheetNames.filter((n) => /^(despesas|receitas)\s*q[1-4]$/i.test(n.trim()));
  if (folhasQ.length > 0) {
    // ---- Formato do balancete ----
    for (const nome of folhasQ) {
      const despesa = /^despesas/i.test(nome.trim());
      const r = linhas(wb.Sheets[nome]);
      const cab = r.findIndex((x) => x && String(x[0] ?? '').trim().toLowerCase() === 'data');
      if (cab < 0) continue;
      for (const x of r.slice(cab + 1)) {
        if (!x || x[0] == null || x[0] === '') continue;
        const d0 = lerData(x[0]);
        const v = lerValor(x[1]);
        if (!d0 || v == null) { avisos.push(`${nome}: linha ignorada (${String(x[0])} / ${String(x[1])})`); continue; }
        const { data, nota } = corrigirFuturo(d0, avisos, nome);
        movimentos.push({
          data,
          valor: despesa ? -Math.abs(v) : Math.abs(v),
          descricao: limpo(x[2]) ?? '(sem descrição)',
          metodo: limpo(x[3]),
          conta: conta(x[4]) ?? 'Sem conta',
          categoria: limpo(x[5]),
          subcategoria: limpo(x[6]),
          fiscal: limpo(x[7]),
          tipo: despesa ? 'DESPESA' : 'RECEITA',
          trimestre: trimestreDe(data),
          origem: null,
          destino: null,
          nota,
        });
      }
    }

    const internos = wb.SheetNames.find((n) => /mov\.?\s*internos/i.test(n));
    if (internos) {
      const r = linhas(wb.Sheets[internos]);
      const cab = r.findIndex((x) => x && String(x[0] ?? '').trim().toLowerCase() === 'data');
      for (const x of cab >= 0 ? r.slice(cab + 1) : []) {
        if (!x || x[0] == null || x[0] === '') continue;
        const d0 = lerData(x[0]);
        const v = lerValor(x[1]);
        if (!d0 || v == null) { avisos.push(`Mov. Internos: linha ignorada (${String(x[0])} / ${String(x[1])})`); continue; }
        const { data, nota: notaData } = corrigirFuturo(d0, avisos, 'Mov. Internos');
        const origem = conta(x[2]);
        const destino = conta(x[3]);
        const nota = [limpo(x[4]), notaData].filter(Boolean).join(' · ') || null;
        const base = { data, metodo: 'Transferência Bancária', categoria: null, subcategoria: null, fiscal: null, tipo: 'INTERNO' as const, trimestre: trimestreDe(data), origem, destino, nota };
        if (origem && destino) {
          // Entre duas contas o sinal escrito varia de ficheiro para ficheiro (2025 positivo,
          // 2026 negativo): o dinheiro sai sempre da origem e entra no destino.
          const t = Math.abs(v);
          movimentos.push({ ...base, valor: -t, conta: origem, descricao: `Transferência para ${destino}` });
          movimentos.push({ ...base, valor: t, conta: destino, descricao: `Transferência de ${origem}` });
        } else if (destino || origem) {
          movimentos.push({ ...base, valor: destino ? v : -v, conta: (destino || origem)!, descricao: limpo(x[4]) ?? 'Movimento interno' });
        }
      }
    }

    const listas: { grupo: string; nome: string }[] = [];
    const dd = wb.SheetNames.find((n) => /dropdown/i.test(n));
    if (dd) {
      for (const x of linhas(wb.Sheets[dd]).slice(1)) {
        if (!x) continue;
        if (limpo(x[0])) listas.push({ grupo: 'metodo', nome: limpo(x[0])! });
        if (limpo(x[2])) listas.push({ grupo: 'categoria', nome: limpo(x[2])! });
        if (limpo(x[3])) listas.push({ grupo: 'subcategoria', nome: limpo(x[3])! });
      }
    }
    return { formato: 'balancete', movimentos, listas, avisos };
  }

  // ---- Extrato / lista simples: o sinal decide ----
  const ws = wb.Sheets[wb.SheetNames[0]];
  const r = linhas(ws);
  const norm = (v: unknown) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cab = r.findIndex((x) => x && x.some((c) => norm(c).startsWith('data')) && x.some((c) => /valor|montante|debito|credito/.test(norm(c))));
  if (cab < 0) throw new Error('Não encontrei as colunas Data e Valor no ficheiro');
  const h = r[cab].map(norm);
  const col = (...nomes: string[]) => h.findIndex((c) => nomes.some((n) => c.startsWith(n)));
  const iData = col('data mov', 'data valor', 'data'), iValor = col('valor', 'montante'), iDeb = col('debito'), iCred = col('credito');
  const iDesc = col('descri', 'movimento', 'historico'), iConta = col('conta', 'fonte', 'destino', 'banco');
  const iMet = col('metodo'), iCat = col('categoria'), iSub = col('sub'), iFis = col('fiscal');
  for (const x of r.slice(cab + 1)) {
    if (!x) continue;
    const d0 = lerData(x[iData]);
    let v = iValor >= 0 ? lerValor(x[iValor]) : null;
    if (v == null && (iDeb >= 0 || iCred >= 0)) {
      const deb = iDeb >= 0 ? lerValor(x[iDeb]) : null, cred = iCred >= 0 ? lerValor(x[iCred]) : null;
      v = cred ? Math.abs(cred) : deb ? -Math.abs(deb) : null;
    }
    if (!d0 || v == null || v === 0) continue;
    const { data, nota } = corrigirFuturo(d0, avisos, 'Linha');
    const c = (iConta >= 0 ? conta(x[iConta]) : null) ?? contaPorDefeito;
    if (!c) throw new Error('O ficheiro não tem coluna de conta: escolha a conta antes de importar');
    movimentos.push({
      data, valor: v, descricao: (iDesc >= 0 ? limpo(x[iDesc]) : null) ?? '(sem descrição)',
      metodo: iMet >= 0 ? limpo(x[iMet]) : null, conta: c,
      categoria: iCat >= 0 ? limpo(x[iCat]) : null, subcategoria: iSub >= 0 ? limpo(x[iSub]) : null, fiscal: iFis >= 0 ? limpo(x[iFis]) : null,
      tipo: v < 0 ? 'DESPESA' : 'RECEITA', trimestre: trimestreDe(data), origem: null, destino: null, nota,
    });
  }
  return { formato: 'extrato', movimentos, listas: [], avisos };
}
