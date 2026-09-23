// Geração do recibo de remunerações em PDF, reproduzindo fielmente o design
// original (software de contabilidade) a partir dos dados do recibo guardado.
// O HTML é convertido em PDF através da API HTML2PDF da Abacus.

import crypto from "crypto";
import { prisma } from "@/lib/db";

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

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Construção do HTML do recibo ──────────────────────────────────────────
export function buildPayslipHtml(p: PayslipRecord, profile: ProfileExtra): string {
  const { date, monthName } = lastDayLabel(p.month);
  const empNum = p.employeeNumber || profile.employeeNumber || "";
  const category = p.category || profile.category || "";
  const salarioBase = p.salarioBase || p.vencimentoBase || 0;
  const unitDay = salarioBase / 30; // valor unitário diário (base do mês comercial)
  const mealPerDay = profile.mealPerDay || 0;

  const moradaLines = (profile.morada || "").split("\n").filter((l) => l.trim().length > 0);

  // ── Linhas de ABONOS ────────────────────────────────────────────────────
  const abonoRows: string[] = [];
  abonoRows.push(
    dataRow("001", "Vencimento Base", `${fmt(30, 2)}D`, fmt(unitDay, 4), fmt(salarioBase, 2))
  );
  if (p.subsAlimentacao > 0 && mealPerDay > 0) {
    const mealDays = p.subsAlimentacao / mealPerDay;
    abonoRows.push(
      dataRow("002", "Subsidio Alimentaçao", fmt(mealDays, 2), fmt(mealPerDay, 2), fmt(p.subsAlimentacao, 2))
    );
  }
  if (p.subsFerias > 0) {
    const qtd = unitDay > 0 ? p.subsFerias / unitDay : 0;
    abonoRows.push(
      dataRow("003", "Subsidio Ferias", `${fmt(qtd, 2)}D`, fmt(unitDay, 4), fmt(p.subsFerias, 2))
    );
  }
  if (p.subsNatal > 0) {
    const qtd = unitDay > 0 ? p.subsNatal / unitDay : 0;
    abonoRows.push(
      dataRow("004", "Subsidio Natal", `${fmt(qtd, 2)}D`, fmt(unitDay, 4), fmt(p.subsNatal, 2))
    );
  }
  if ((p.premioAssiduidade || 0) > 0) {
    abonoRows.push(
      dataRow("005", "Prémio Assiduidade", "", fmt(p.premioAssiduidade, 2), fmt(p.premioAssiduidade, 2))
    );
  }
  if ((p.outrosAbonos || 0) > 0) {
    abonoRows.push(
      dataRow("006", "Outros Abonos", "", fmt(p.outrosAbonos, 2), fmt(p.outrosAbonos, 2))
    );
  }

  // ── Linhas de FALTAS ─────────────────────────────────────────────────────
  const faltaRows: string[] = [];
  if ((p.totalFaltas || 0) > 0) {
    const qtd = unitDay > 0 ? p.totalFaltas / unitDay : 0;
    faltaRows.push(
      dataRow("002", "Desc. Falta Just.", `${fmt(qtd, 2)}D`, fmt(-unitDay, 4), fmt(-p.totalFaltas, 2))
    );
  }

  // ── Linhas de DESCONTOS ──────────────────────────────────────────────────
  const baseIncidencia =
    p.vencimentoBase + p.subsFerias + p.subsNatal + (p.premioAssiduidade || 0);
  const ssRate = profile.ssRate ?? 0.11;
  const irsRate = profile.irsRate ?? 0;
  const descRows: string[] = [];
  descRows.push(
    dataRow("001", "Segurança Social", pct(ssRate), fmt(baseIncidencia, 2), fmt(p.segSocial, 2))
  );
  descRows.push(
    dataRow("002", "Imposto s/Rendimento", pct(irsRate), fmt(baseIncidencia, 2), fmt(p.irs, 2))
  );
  if ((p.outrosDescontos || 0) > 0) {
    descRows.push(
      dataRow("003", "Outros Descontos", "", "", fmt(p.outrosDescontos, 2))
    );
  }

  const empBoxLines = [
    `<span class="emp-num">${esc(empNum)}</span> <strong>${esc(p.name)}</strong>`,
    ...moradaLines.map((l) => esc(l)),
  ].join("<br>");

  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body { font-family: "Courier New", Courier, monospace; color:#000; font-size:12px; }
  .recibo { padding: 10px 14px; }
  table { border-collapse: collapse; width:100%; }
  .hdr td { vertical-align: bottom; padding-bottom:2px; }
  .company-name { font-size:19px; font-weight:bold; }
  .recibo-title { font-size:12px; font-weight:bold; text-align:right; letter-spacing:0.3px; }
  .top td { vertical-align: top; }
  .company-addr { width:42%; line-height:2.0; padding-top:6px; }
  .emp-cell { width:58%; padding-top:2px; }
  .emp-box { border:1px solid #000; background:#e6e6e6; padding:8px 12px; line-height:1.7; min-height:78px; }
  .emp-num { display:inline-block; margin-right:14px; }
  .info { border-top:1px solid #000; border-bottom:1px solid #000; margin-top:6px; }
  .info td { padding:2px 6px; font-size:12px; }
  .info .divL { border-left:1px solid #000; }
  .info-right td { padding:0 6px; }
  .info-right .rlbl { text-align:right; }
  .info-right .rval { text-align:right; }
  .main { border:1px solid #000; border-top:none; }
  .main td { padding:2px 8px; font-size:12px; }
  .main .c1 { width:43%; }
  .main .c2 { width:21%; text-align:right; border-left:1px solid #000; }
  .main .c3 { width:20%; text-align:right; border-left:1px solid #000; }
  .main .c4 { width:16%; text-align:right; border-left:1px solid #000; }
  .main .sec td { background:#e6e6e6; font-weight:bold; font-size:11px; border-top:1px solid #000; border-bottom:1px solid #000; }
  .main .filler td { height:70px; }
  .foot { margin-top:0; }
  .foot td { vertical-align: bottom; }
  .sig { width:34%; padding:0 8px; }
  .sig .line { border-top:1px solid #000; text-align:center; font-style:italic; padding-top:2px; margin-top:44px; font-size:11px; }
  .mid { width:28%; vertical-align:bottom; font-size:11px; }
  .mid .marital { border:1px solid #000; border-bottom:none; padding:2px 6px; }
  .acc { border-collapse:collapse; width:100%; }
  .acc td { border:1px solid #000; text-align:center; padding:1px 4px; font-size:10px; }
  .tot { width:38%; }
  .tot > table { width:100%; }
  .tot td { padding:2px 6px; font-size:12px; white-space:nowrap; }
  .tot .val { width:100%; }
  .tot .lbl { text-align:left; }
  .tot .val { text-align:right; }
  .tot .liq td { background:#d9d9d9; font-weight:bold; }
  .filosoft { border-top:1px solid #000; margin-top:4px; }
  .filosoft td { font-size:10px; font-weight:bold; padding-top:2px; }
</style></head>
<body><div class="recibo">

  <table class="hdr"><tr>
    <td class="company-name">${esc(COMPANY.name)}</td>
    <td class="recibo-title">RECIBO DE REMUNERAÇÕES</td>
  </tr></table>

  <table class="top"><tr>
    <td class="company-addr">${COMPANY.address.map(esc).join("<br>")}</td>
    <td class="emp-cell"><div class="emp-box">${empBoxLines}</div></td>
  </tr></table>

  <table class="info"><tr>
    <td>NIF: ${esc(COMPANY.nif)}</td>
    <td class="divL">${date} -</td>
    <td class="divL">${monthName}</td>
    <td class="divL">${esc(category)}</td>
    <td class="divL" style="width:32%;padding:0;">
      <table class="info-right">
        <tr><td class="rlbl">N.I.F. :</td><td class="rval">${esc(profile.nif || "")}</td></tr>
        <tr><td class="rlbl">Seg. Social:</td><td class="rval">${esc(profile.numSegSocial || "")}</td></tr>
        <tr><td class="rlbl">Salário Base:</td><td class="rval">${eur(salarioBase)}</td></tr>
      </table>
    </td>
  </tr></table>

  <table class="main">
    ${sectionHeader("ABONOS", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR")}
    ${abonoRows.join("\n")}
    ${faltaRows.length ? sectionHeader("FALTAS", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR") : ""}
    ${faltaRows.join("\n")}
    ${sectionHeader("DESCONTOS", "VAL./TAXA", "INCIDÊNCIA", "VALOR")}
    ${descRows.join("\n")}
    <tr class="filler"><td class="c1"></td><td class="c2"></td><td class="c3"></td><td class="c4"></td></tr>
  </table>

  <table class="foot"><tr>
    <td class="sig"><div class="line">Assinatura</div></td>
    <td class="mid">
      <div class="marital">Não Cas.,0 Dep.</div>
      <table class="acc">
        <tr><td>Ac.Incid.IRS</td><td>Ac.Ret.IRS</td><td>Ac.S.Tx.IRS</td></tr>
        <tr><td>${eur(baseIncidencia)}</td><td>${eur(p.irs)}</td><td>${eur(0)}</td></tr>
      </table>
    </td>
    <td class="tot">
      <table>
        <tr><td class="lbl">Total Ilíquido:</td><td class="val">${eur(p.totalIliquido)}</td></tr>
        <tr><td class="lbl">Total de Descontos:</td><td class="val">${eur(p.totalDescontos)}</td></tr>
        <tr class="liq"><td class="lbl">Líquido a receber:</td><td class="val">${eur(p.liquido)}</td></tr>
      </table>
    </td>
  </tr></table>

  <table class="filosoft"><tr>
    <td>${esc(COMPANY.softwareLeft)}</td>
    <td style="text-align:right;">${esc(COMPANY.softwareRight)}</td>
  </tr></table>

</div></body></html>`;
}

function dataRow(code: string, desc: string, qty: string, unit: string, valor: string): string {
  return `<tr><td class="c1">${code} ${esc(desc)}</td><td class="c2">${qty}</td><td class="c3">${unit}</td><td class="c4">${valor}</td></tr>`;
}
function sectionHeader(name: string, h2: string, h3: string, h4: string): string {
  return `<tr class="sec"><td class="c1">${name}</td><td class="c2">${h2}</td><td class="c3">${h3}</td><td class="c4">${h4}</td></tr>`;
}

// ── Conversão HTML → PDF via API HTML2PDF ─────────────────────────────────
export async function renderPayslipPdf(html: string): Promise<Buffer> {
  const token = process.env.ABACUSAI_API_KEY;
  if (!token) throw new Error("ABACUSAI_API_KEY em falta");

  const createRes = await fetch("https://apps.abacus.ai/api/createConvertHtmlToPdfRequest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployment_token: token,
      html_content: html,
      pdf_options: { format: "A4", print_background: true, margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" } },
    }),
  });
  const createData = await createRes.json().catch(() => ({}));
  const requestId = createData?.request_id || createData?.result?.request_id;
  if (!requestId) {
    throw new Error(`Falha ao criar pedido de PDF: ${JSON.stringify(createData).slice(0, 300)}`);
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await fetch("https://apps.abacus.ai/api/getConvertHtmlToPdfStatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, deployment_token: token }),
    });
    const statusData = await statusRes.json().catch(() => ({}));
    const status = statusData?.status || statusData?.result?.status;
    if (status === "SUCCESS") {
      const b64 = statusData?.result?.result || statusData?.result;
      if (typeof b64 === "string") return Buffer.from(b64, "base64");
      throw new Error("PDF gerado mas sem conteúdo devolvido");
    }
    if (status === "FAILED") {
      throw new Error(`Geração de PDF falhou: ${JSON.stringify(statusData).slice(0, 300)}`);
    }
  }
  throw new Error("Tempo esgotado ao gerar o PDF do recibo");
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

  const html = buildPayslipHtml(p, profile);
  const buffer = await renderPayslipPdf(html);
  const safeName = p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `recibo-${safeName}-${p.month}.pdf`;
  return { buffer, filename };
}
