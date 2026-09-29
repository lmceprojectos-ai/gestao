// Geração do recibo de remunerações em PDF, reproduzindo fielmente o design
// original (software de contabilidade) a partir dos dados do recibo guardado.
// O PDF é desenhado no próprio servidor (lib/pdf/folha).

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { Folha } from "@/lib/pdf/folha";

// ── Dados fixos da empresa (conforme o recibo oficial enviado) ────────────
export const COMPANY = {
  name: "Criaconsensos Unipessoal Lda",
  nif: "515943401",
  address: ["Rua João Lino Armazém 20 E Lt35", "Palhais", "2830-222 Barreiro"],
  softwareLeft:
    "Filosoft SIGEP.32 (20.3.0.29)  - [HB13I1823] - JMMJ CONSULT-CONS. GESTÃO E CONTAB.,LDA",
  softwareRight: "(c) FiloSoft - Software, Lda.",
};

// ── Tipos ─────────────────────────────────────────────────────────────────
export type PayslipRecord = {
  id: string;
  month: string;
  userId?: string | null;
  employeeNumber?: string | null;
  name: string;
  category?: string | null;
  salarioBase: number;
  vencimentoBase: number;
  subsAlimentacao: number;
  subsFerias: number;
  subsNatal: number;
  outrosAbonos: number;
  totalFaltas: number;
  premioAssiduidade: number;
  segSocial: number;
  irs: number;
  outrosDescontos: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
};

export type ProfileExtra = {
  nif?: string | null;
  numSegSocial?: string | null;
  morada?: string | null;
  mealPerDay?: number | null;
  ssRate?: number | null;
  irsRate?: number | null;
  employeeNumber?: string | null;
  category?: string | null;
};

// ── Assinatura de token para download seguro (fora da sessão) ─────────────
function tokenSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || "livro-de-ponto";
}

export function signPayslipToken(id: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(id).digest("hex");
}

export function verifyPayslipToken(id: string, token: string): boolean {
  try {
    const expected = signPayslipToken(id);
    const a = Buffer.from(expected);
    const b = Buffer.from(token || "");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Formatação numérica (estilo do recibo: 1.132,67 / 30,6667) ────────────
function fmt(v: number, dec = 2): string {
  const neg = v < 0;
  const abs = Math.abs(Number.isFinite(v) ? v : 0);
  const parts = abs.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + parts.join(",");
}
function eur(v: number): string {
  return `€ ${fmt(v, 2)}`;
}
function pct(rate: number): string {
  return `${fmt(rate * 100, 2)}%`;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
function lastDayLabel(month: string): { date: string; monthName: string } {
  const [y, m] = (month ?? "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return { date: month, monthName: "" };
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    date: `${String(last).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
    monthName: MESES[m - 1],
  };
}

// ── Desenho do recibo (PDF A4) ────────────────────────────────────────────
type Linha = [string, string, string, string]; // descrição, quantidade, unitário, valor

export async function desenharRecibo(p: PayslipRecord, profile: ProfileExtra): Promise<Buffer> {
  const { date, monthName } = lastDayLabel(p.month);
  const empNum = p.employeeNumber || profile.employeeNumber || "";
  const category = p.category || profile.category || "";
  const salarioBase = p.salarioBase || p.vencimentoBase || 0;
  const unitDay = salarioBase / 30; // valor unitário diário (base do mês comercial)
  const mealPerDay = profile.mealPerDay || 0;
  const moradaLines = (profile.morada || "").split("\n").filter((l) => l.trim().length > 0);

  // ── Linhas de ABONOS ────────────────────────────────────────────────────
  const abonos: Linha[] = [["001 Vencimento Base", `${fmt(30, 2)}D`, fmt(unitDay, 4), fmt(salarioBase, 2)]];
  if (p.subsAlimentacao > 0 && mealPerDay > 0) {
    abonos.push(["002 Subsidio Alimentaçao", fmt(p.subsAlimentacao / mealPerDay, 2), fmt(mealPerDay, 2), fmt(p.subsAlimentacao, 2)]);
  }
  if (p.subsFerias > 0) {
    abonos.push(["003 Subsidio Ferias", `${fmt(unitDay > 0 ? p.subsFerias / unitDay : 0, 2)}D`, fmt(unitDay, 4), fmt(p.subsFerias, 2)]);
  }
  if (p.subsNatal > 0) {
    abonos.push(["004 Subsidio Natal", `${fmt(unitDay > 0 ? p.subsNatal / unitDay : 0, 2)}D`, fmt(unitDay, 4), fmt(p.subsNatal, 2)]);
  }
  if ((p.premioAssiduidade || 0) > 0) {
    abonos.push(["005 Prémio Assiduidade", "", fmt(p.premioAssiduidade, 2), fmt(p.premioAssiduidade, 2)]);
  }
  if ((p.outrosAbonos || 0) > 0) {
    abonos.push(["006 Outros Abonos", "", fmt(p.outrosAbonos, 2), fmt(p.outrosAbonos, 2)]);
  }

  // ── Linhas de FALTAS ─────────────────────────────────────────────────────
  const faltas: Linha[] = [];
  if ((p.totalFaltas || 0) > 0) {
    faltas.push(["002 Desc. Falta Just.", `${fmt(unitDay > 0 ? p.totalFaltas / unitDay : 0, 2)}D`, fmt(-unitDay, 4), fmt(-p.totalFaltas, 2)]);
  }

  // ── Linhas de DESCONTOS ──────────────────────────────────────────────────
  const baseIncidencia = p.vencimentoBase + p.subsFerias + p.subsNatal + (p.premioAssiduidade || 0);
  const ssRate = profile.ssRate ?? 0.11;
  const irsRate = profile.irsRate ?? 0;
  const descontos: Linha[] = [
    ["001 Segurança Social", pct(ssRate), fmt(baseIncidencia, 2), fmt(p.segSocial, 2)],
    ["002 Imposto s/Rendimento", pct(irsRate), fmt(baseIncidencia, 2), fmt(p.irs, 2)],
  ];
  if ((p.outrosDescontos || 0) > 0) descontos.push(["003 Outros Descontos", "", "", fmt(p.outrosDescontos, 2)]);

  const f = await Folha.criar("courier", 23);
  const x = f.margem;
  const W = f.largura;
  const cinza = "#e6e6e6";
  let y = 28;

  // Cabeçalho
  f.texto(COMPANY.name, x, y, { size: 17, bold: true });
  f.texto("RECIBO DE REMUNERAÇÕES", x, y + 5, { size: 11, bold: true, align: "right", width: W });
  y += 26;

  // Morada da empresa | caixa do colaborador
  const wEsq = W * 0.42;
  COMPANY.address.forEach((l, i) => f.texto(l, x, y + 6 + i * 20, { size: 10.5 }));
  const empLinhas = [`${empNum}  ${p.name}`, ...moradaLines];
  const hEmp = Math.max(78, 16 + empLinhas.length * 17);
  f.caixa(x + wEsq, y, W - wEsq, hEmp, { fill: cinza, border: "#000000" });
  empLinhas.forEach((l, i) => {
    if (i === 0) {
      f.texto(empNum, x + wEsq + 12, y + 9, { size: 10.5 });
      f.texto(p.name, x + wEsq + 12 + (empNum ? f.medir(empNum + "  ", 10.5) : 0), y + 9, { size: 10.5, bold: true, width: W - wEsq - 24 - f.medir(empNum + "  ", 10.5) });
    } else f.texto(l, x + wEsq + 12, y + 9 + i * 17, { size: 10.5, width: W - wEsq - 24 });
  });
  y += Math.max(hEmp, 66) + 6;

  // Faixa de informação
  const hInfo = 45;
  f.linha(x, y, x + W, y);
  f.linha(x, y + hInfo, x + W, y + hInfo);
  const info = [W * 0.19, W * 0.17, W * 0.12, W * 0.2, W * 0.32];
  const valoresInfo = [`NIF: ${COMPANY.nif}`, `${date} -`, monthName, category];
  let cx = x;
  info.forEach((w, i) => {
    if (i > 0) f.linha(cx, y, cx, y + hInfo);
    if (i < 4) f.texto(valoresInfo[i], cx + 5, y + 5, { size: 10, width: w - 10 });
    cx += w;
  });
  const direita: Array<[string, string]> = [["N.I.F. :", profile.nif || ""], ["Seg. Social:", profile.numSegSocial || ""], ["Salário Base:", eur(salarioBase)]];
  const xDir = x + W - info[4];
  direita.forEach(([k, v], i) => {
    f.texto(k, xDir + 4, y + 4 + i * 13.5, { size: 10, align: "right", width: info[4] * 0.45 });
    f.texto(v, xDir + info[4] * 0.45 + 8, y + 4 + i * 13.5, { size: 10, align: "right", width: info[4] * 0.55 - 14 });
  });
  y += hInfo;

  // Tabela principal (abonos, faltas, descontos)
  const cols = [W * 0.43, W * 0.21, W * 0.2, W * 0.16];
  const topoTabela = y;
  const secao = (nome: string, h2: string, h3: string, h4: string) => {
    f.caixa(x, y, W, 15, { fill: cinza });
    f.linha(x, y, x + W, y);
    f.linha(x, y + 15, x + W, y + 15);
    [nome, h2, h3, h4].forEach((t, i) => {
      const x0 = x + cols.slice(0, i).reduce((a, b) => a + b, 0);
      f.texto(t, x0 + 6, y + 3.5, { size: 9, bold: true, align: i === 0 ? "left" : "right", width: cols[i] - 12 });
    });
    y += 15;
  };
  const linhas = (ls: Linha[]) => {
    for (const l of ls) {
      l.forEach((t, i) => {
        const x0 = x + cols.slice(0, i).reduce((a, b) => a + b, 0);
        f.texto(t, x0 + 6, y + 3, { size: 10, align: i === 0 ? "left" : "right", width: cols[i] - 12 });
      });
      y += 15;
    }
  };
  secao("ABONOS", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR");
  linhas(abonos);
  if (faltas.length) {
    secao("FALTAS", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR");
    linhas(faltas);
  }
  secao("DESCONTOS", "VAL./TAXA", "INCIDÊNCIA", "VALOR");
  linhas(descontos);
  y += 70; // espaço em branco no fim da tabela
  f.caixa(x, topoTabela, W, y - topoTabela, { border: "#000000" });
  cx = x;
  cols.slice(0, 3).forEach((w) => { cx += w; f.linha(cx, topoTabela, cx, y); });

  // Rodapé: assinatura | estado civil + acumulados | totais
  const wSig = W * 0.34, wMid = W * 0.28, wTot = W - wSig - wMid;
  const topoRodape = y + 4;
  f.linha(x + 8, topoRodape + 50, x + wSig - 8, topoRodape + 50);
  f.texto("Assinatura", x + 8, topoRodape + 53, { size: 9, italic: true, align: "center", width: wSig - 16 });

  const xm = x + wSig;
  f.caixa(xm, topoRodape + 20, wMid, 14, { border: "#000000" });
  f.texto("Não Cas.,0 Dep.", xm + 5, topoRodape + 23, { size: 9 });
  const acc = [["Ac.Incid.IRS", "Ac.Ret.IRS", "Ac.S.Tx.IRS"], [eur(baseIncidencia), eur(p.irs), eur(0)]];
  acc.forEach((row, r) => {
    row.forEach((t, c) => {
      const w = wMid / 3;
      f.caixa(xm + c * w, topoRodape + 34 + r * 14, w, 14, { border: "#000000" });
      f.texto(t, xm + c * w, topoRodape + 37 + r * 14, { size: 7.5, align: "center", width: w });
    });
  });

  const xt = x + wSig + wMid + 6;
  const tots: Array<[string, string]> = [["Total Ilíquido:", eur(p.totalIliquido)], ["Total de Descontos:", eur(p.totalDescontos)], ["Líquido a receber:", eur(p.liquido)]];
  tots.forEach(([k, v], i) => {
    const yy = topoRodape + 20 + i * 14;
    if (i === 2) f.caixa(xt, yy, wTot - 6, 14, { fill: "#d9d9d9" });
    f.texto(k, xt + 4, yy + 3, { size: 9.5, bold: i === 2 });
    f.texto(v, xt + 4, yy + 3, { size: 9.5, bold: i === 2, align: "right", width: wTot - 14 });
  });
  y = topoRodape + 66;

  // Linha do software de contabilidade
  f.linha(x, y, x + W, y);
  f.texto(COMPANY.softwareLeft, x, y + 3, { size: 6.5, bold: true, width: W * 0.72 });
  f.texto(COMPANY.softwareRight, x, y + 3, { size: 6.5, bold: true, align: "right", width: W });

  return f.guardar();
}


// ── Carregar recibo + perfil e gerar PDF ──────────────────────────────────
export async function generatePayslipPdfById(
  id: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  const p = (await prisma.payslip.findUnique({ where: { id } })) as PayslipRecord | null;
  if (!p) return null;

  let profile: ProfileExtra = {};
  if (p.userId) {
    const byUser = await prisma.salaryProfile.findUnique({ where: { userId: p.userId } });
    if (byUser) profile = byUser as unknown as ProfileExtra;
  }
  if (!profile.nif) {
    const byName = await prisma.salaryProfile.findUnique({ where: { name: p.name } }).catch(() => null);
    if (byName) profile = byName as unknown as ProfileExtra;
  }

  const buffer = await desenharRecibo(p, profile);
  const safeName = p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `recibo-${safeName}-${p.month}.pdf`;
  return { buffer, filename };
}
