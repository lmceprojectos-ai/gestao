// Geração do registo de assiduidade mensal em PDF (para a contabilidade).
// Mostra, dia a dia, as marcações de ponto de cada colaborador — incluindo
// a hora de saída/regresso do almoço — bem como férias, faltas e feriados.
// O PDF é desenhado no próprio servidor (lib/pdf/folha); reutiliza a assinatura
// de tokens do módulo do recibo.

import { prisma } from "@/lib/db";
import { COMPANY, signPayslipToken } from "@/lib/ponto/payslip-pdf";
import { Folha } from "@/lib/pdf/folha";
import { workedMinutesForDay, formatMinutes, eachDate } from "@/lib/ponto/schedule";
import {
  isHoliday,
  isBridge,
  holidayName,
  bridgeHolidayName,
} from "@/lib/ponto/holidays";
import { eur } from "@/lib/ponto/payslip";
import { computeAttendanceBonus, type DelayInfo } from "@/lib/ponto/bonus";
import { countBonusInjustifiedDays } from "@/lib/ponto/bonus-data";
import { todayStr } from "@/lib/ponto/format";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Hora HH:MM no fuso de Lisboa
function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Período do registo, igual ao fecho dos recibos: do dia 26 do mês anterior ao
// dia 25 do mês (ex.: setembro = 26/08 a 25/09).
export function periodoAssiduidade(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map((v) => parseInt(v, 10));
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return {
    from: `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-26`,
    to: `${y}-${pad(m)}-25`,
  };
}

function periodoTexto(month: string): string {
  const { from, to } = periodoAssiduidade(month);
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  return `${f(from)} a ${f(to)}`;
}

type DayRow = {
  day: number;
  mes: number; // mês do dia (o período vai de 26 do mês anterior a 25 do mês)
  dow: number; // 0=Dom .. 6=Sáb
  entrada: string;
  saidaAlmoco: string;
  regressoAlmoco: string;
  saidaFinal: string;
  saida: string; // saída única (tempo parcial): saída final ou, na sua falta, saída do almoço
  horas: string;
  worked: boolean;
  obs: string;
  comprovativoUrl?: string; // link para o anexo/comprovativo (falta justificada)
};

// ── Desenho do registo de assiduidade (PDF A4) ────────────────────────────
export async function desenharAssiduidade(opts: {
  name: string;
  employeeNumber?: string | null;
  category?: string | null;
  month: string; // AAAA-MM
  rows: DayRow[];
  partTime?: boolean;
  totals: { diasTrabalhados: number; totalMin: number; ferias: number; faltas: number };
  bonus?: {
    effective: boolean;
    qualified: boolean;
    amount: number;
    reasons: string[];
  };
}): Promise<Buffer> {
  const [yStr, mStr] = opts.month.split("-");
  const y0 = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const monthName = m >= 1 && m <= 12 ? MESES[m - 1] : opts.month;

  const partTime = !!opts.partTime;
  // Num colaborador a tempo parcial, se houver pelo menos um dia com pausa de
  // almoço registada (dia completo), incluímos também as colunas de almoço para
  // que esses dias mostrem a saída e o regresso do almoço. Caso contrário, usa-se
  // o formato compacto (apenas Entrada e Saída).
  const partTimeHasLunch = partTime && opts.rows.some((r) => r.saidaAlmoco || r.regressoAlmoco);
  const partTimeCompact = partTime && !partTimeHasLunch;

  const f = await Folha.criar("helvetica", 28);
  const x = f.margem;
  const W = f.largura;

  const pesos = partTimeCompact ? [16, 17, 17, 14, 36] : [13, 13, 14, 15, 13, 12, 20];
  const titulos = partTimeCompact
    ? ["Dia", "Entrada", "Saída", "Horas", "Observações"]
    : ["Dia", "Entrada", "Saída almoço", "Regresso almoço", partTimeHasLunch ? "Saída" : "Saída final", "Horas", "Observações"];
  const cols = pesos.map((p, i) => ({ w: (W * p) / 100, align: (i === 0 || i === pesos.length - 1 ? "left" : "center") as "left" | "center" }));

  let y = 24;
  const cabecalho = () => {
    f.texto(COMPANY.name, x, y, { size: 15, bold: true });
    f.texto(`NIF ${COMPANY.nif} · Livro de Ponto`, x, y + 19, { size: 9.5, color: "#6b7280" });
    f.texto("REGISTO DE ASSIDUIDADE", x, y + 2, { size: 12, bold: true, align: "right", width: W });
    f.texto(`${monthName} de ${y0} · ${periodoTexto(opts.month)}`, x, y + 19, { size: 9.5, color: "#6b7280", align: "right", width: W });
    y += 34;
    f.linha(x, y, x + W, y, { color: "#feca00", width: 3 });
    y += 10;
  };
  const cabecalhoTabela = () => {
    y += f.linhaTabela(x, y, cols.map((c) => ({ ...c, align: "center" as const })), titulos.map((t) => ({ t })), {
      size: 9, pad: 5, bold: true, fill: "#feca00", border: "#e5b800", color: "#1f2937",
    });
  };

  cabecalho();
  // Colaborador
  let xe = x;
  if (opts.employeeNumber) {
    const t = `N.º ${opts.employeeNumber}`;
    f.texto(t, x, y, { size: 10, color: "#6b7280" });
    xe += f.medir(t, 10) + 10;
  }
  f.texto(opts.name, xe, y, { size: 11, bold: true });
  if (opts.category) f.texto(` — ${opts.category}`, xe + f.medir(opts.name, 11, true), y + 1, { size: 10 });
  y += 22;
  cabecalhoTabela();

  const fundoPagina = 841.89 - f.margem;
  // Mês anterior (dias 26 a 31) a azul; mês do recibo (1 a 25) a amarelo.
  const COR_ANTERIOR = { faixa: "#dbeafe", texto: "#1e40af", dia: "#1d4ed8", borda: "#bfdbfe" };
  const COR_ATUAL = { faixa: "#fef3c7", texto: "#92400e", dia: "#111827", borda: "#fde68a" };
  let mesDaFaixa = -1;
  for (const r of opts.rows) {
    const anterior = r.mes !== m;
    const cor = anterior ? COR_ANTERIOR : COR_ATUAL;
    if (r.mes !== mesDaFaixa) {
      mesDaFaixa = r.mes;
      const doMes = opts.rows.filter((rr) => rr.mes === r.mes);
      const nome = MESES[r.mes - 1] ?? "";
      const texto = `${nome.toUpperCase()} — ${anterior ? "mês anterior" : "mês do recibo"} (dias ${pad(doMes[0].day)} a ${pad(doMes[doMes.length - 1].day)})`;
      const faixa = { size: 8.5, pad: 4, fill: cor.faixa, border: cor.borda, bold: true, color: cor.texto };
      if (y + f.alturaLinhaTabela([{ w: W }], [{ t: texto }], faixa) + 20 > fundoPagina) {
        f.novaPagina();
        y = 24;
        cabecalho();
        cabecalhoTabela();
      }
      y += f.linhaTabela(x, y, [{ w: W }], [{ t: texto }], faixa);
    }
    const weekend = r.dow === 0 || r.dow === 6;
    const shade = weekend || (!r.worked && r.obs) ? "#f3f4f6" : undefined;
    const obsColor = /Falta injustificada/i.test(r.obs) ? "#b91c1c" : /Férias|Feriado|Ponte|Falta/i.test(r.obs) ? "#1d4ed8" : "#374151";
    const dia = `${pad(r.day)}/${pad(r.mes)} ${DOW[r.dow]}`;
    const h = (v: string) => v || "—";
    // Tempo parcial com colunas de almoço: um dia só de manhã (sem pausa e com
    // saída antes das 14:30) mostra a saída em "Saída almoço".
    const soManha = partTimeHasLunch && !r.saidaAlmoco && !r.regressoAlmoco && !!r.saida && r.saida < "14:30";
    const valores = partTimeCompact
      ? [dia, h(r.entrada), h(r.saida), r.horas || ""]
      : soManha
      ? [dia, h(r.entrada), h(r.saida), h(""), h(""), r.horas || ""]
      : [dia, h(r.entrada), h(r.saidaAlmoco), h(r.regressoAlmoco), h(partTimeHasLunch ? r.saida : r.saidaFinal), r.horas || ""];
    const cells = [
      { t: valores[0], color: cor.dia, bold: anterior },
      ...valores.slice(1).map((t) => ({ t })),
      { t: r.obs, color: obsColor, bold: /Falta injustificada/i.test(r.obs), link: r.comprovativoUrl, linkText: "Ver comprovativo" },
    ];
    const o = { size: 9, pad: 3.5, fill: shade, border: "#e5e7eb" };
    if (y + f.alturaLinhaTabela(cols, cells, o) > fundoPagina) {
      f.novaPagina();
      y = 24;
      cabecalho();
      cabecalhoTabela();
    }
    // Barra de cor à esquerda de cada dia, com a cor do mês
    const hLinha = f.linhaTabela(x, y, cols, cells, o);
    f.caixa(x, y, 3, hLinha, { fill: anterior ? COR_ANTERIOR.dia : "#f59e0b" });
    y += hLinha;
  }

  // Totais
  y += 12;
  if (y + 70 > fundoPagina) { f.novaPagina(); y = 24; cabecalho(); }
  const tc = [0.18, 0.08, 0.15, 0.12, 0.15, 0.08, 0.14, 0.1].map((p) => ({ w: W * p }));
  y += f.linhaTabela(x, y, tc, [
    { t: "Dias trabalhados", color: "#6b7280" }, { t: String(opts.totals.diasTrabalhados), bold: true, align: "right" },
    { t: "Total de horas", color: "#6b7280" }, { t: formatMinutes(opts.totals.totalMin), bold: true, align: "right" },
    { t: "Dias de férias", color: "#6b7280" }, { t: String(opts.totals.ferias), bold: true, align: "right" },
    { t: "Faltas", color: "#6b7280" }, { t: String(opts.totals.faltas), bold: true, align: "right" },
  ], { size: 10, pad: 6, border: "#e5e7eb" });

  if (opts.bonus && opts.bonus.effective) {
    y += 8;
    const bc = [{ w: W * 0.34 }, { w: W * 0.66 }];
    y += f.linhaTabela(x, y, bc, [
      { t: "Prémio de assiduidade e pontualidade", color: "#6b7280" },
      { t: opts.bonus.qualified ? `QUALIFICADO — ${eur(opts.bonus.amount)}` : "NÃO QUALIFICADO", bold: true, color: opts.bonus.qualified ? "#15803d" : "#b91c1c" },
    ], { size: 10, pad: 6, border: "#e5e7eb" });
    if (!opts.bonus.qualified && opts.bonus.reasons.length) {
      y += f.linhaTabela(x, y, bc, [{ t: "Motivo(s)", color: "#6b7280" }, { t: opts.bonus.reasons.join("\n"), color: "#6b7280" }], { size: 10, pad: 6, border: "#e5e7eb" });
    }
  }

  y += 14;
  f.texto("Documento gerado automaticamente a partir dos registos de ponto. Horas calculadas com base nas marcações de entrada/saída.", x, y, { size: 8.5, color: "#9ca3af", width: W });

  return f.guardar();
}

// ── Carregar dados e gerar o PDF ──────────────────────────────────────────
export async function generateAttendancePdfById(
  payslipId: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  const payslip = await prisma.payslip.findUnique({ where: { id: payslipId } });
  if (!payslip) return null;
  const month = payslip.month;
  const [yStr, mStr] = month.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (!y || !m) return null;
  // Do dia 26 do mês anterior ao dia 25 do mês (o fecho dos recibos).
  const { from, to } = periodoAssiduidade(month);

  // Determinar o utilizador (por userId ou por nome)
  let userId = payslip.userId || null;
  let employeeNumber = payslip.employeeNumber || null;
  let category = payslip.category || null;
  let partTime = false;
  if (!userId) {
    const u = await prisma.user.findFirst({ where: { name: payslip.name } });
    if (u) { userId = u.id; partTime = !!u.partTime; }
  }
  if (userId) {
    const prof = await prisma.salaryProfile.findUnique({ where: { userId } }).catch(() => null);
    if (prof) {
      employeeNumber = employeeNumber || prof.employeeNumber || null;
      category = category || prof.category || null;
    }
    const uPt = await prisma.user.findUnique({ where: { id: userId }, select: { partTime: true } }).catch(() => null);
    if (uPt) partTime = !!uPt.partTime;
  }

  const punches = userId
    ? await prisma.timeRecord.findMany({
        where: { userId, workDate: { gte: from, lte: to } },
        orderBy: { timestamp: "asc" },
      })
    : [];
  const absences = userId
    ? await prisma.absence.findMany({ where: { userId, absenceDate: { gte: from, lte: to } } })
    : [];
  const vacations = userId
    ? await prisma.vacationRequest.findMany({
        where: { userId, status: "APROVADA" },
      })
    : [];

  // Índices por dia
  const punchesByDay = new Map<string, { type: string; timestamp: Date }[]>();
  for (const p of punches) {
    const arr = punchesByDay.get(p.workDate) ?? [];
    arr.push({ type: p.type, timestamp: p.timestamp });
    punchesByDay.set(p.workDate, arr);
  }
  const absenceByDay = new Map<
    string,
    {
      id: string;
      status: string;
      reason?: string | null;
      observation?: string | null;
      hasAttachment: boolean;
    }
  >();
  for (const a of absences)
    absenceByDay.set(a.absenceDate, {
      id: a.id,
      status: a.status,
      reason: a.reason,
      observation: a.observation,
      hasAttachment: !!a.attachmentPath,
    });

  const base = process.env.NEXTAUTH_URL || "";

  // Deteta se uma ausência corresponde a férias (mesma regra do calendário).
  const isFeriasAbsence = (a: { reason?: string | null; observation?: string | null }): boolean => {
    const s = `${a?.reason ?? ""} ${a?.observation ?? ""}`.toLowerCase();
    return s.includes("féri") || s.includes("feri");
  };
  const isVacationDay = (ds: string): boolean =>
    vacations.some((v) => ds >= v.startDate && ds <= v.endDate);

  const ABSENCE_OBS: Record<string, string> = {
    POR_JUSTIFICAR: "Falta por justificar",
    EM_ANALISE: "Falta em análise",
    JUSTIFICADA: "Falta justificada",
    INJUSTIFICADA: "Falta injustificada",
  };

  const rows: DayRow[] = [];
  let diasTrabalhados = 0;
  let totalMin = 0;
  let ferias = 0;
  let faltas = 0;
  const today = todayStr();

  for (const ds of eachDate(from, to)) {
    const [dy, dm, d] = ds.split("-").map((v) => parseInt(v, 10));
    const dow = new Date(Date.UTC(dy, dm - 1, d)).getUTCDay();
    const dp = punchesByDay.get(ds) ?? [];
    const byType = (t: string) => dp.find((x) => x.type === t)?.timestamp ?? null;
    const entrada = byType("ENTRADA");
    const saidaAlmoco = byType("SAIDA_ALMOCO");
    const regresso = byType("REGRESSO_ALMOCO");
    const saidaFinal = byType("SAIDA_FINAL");
    const worked = !!entrada || !!saidaFinal;
    const min = worked ? workedMinutesForDay(dp) : 0;

    // Observações (prioridade: férias > falta > feriado/ponte > fim de semana)
    let obs = "";
    let comprovativoUrl: string | undefined;
    const abs = absenceByDay.get(ds);
    if (abs && isFeriasAbsence(abs)) {
      obs = "Férias";
      ferias++;
    } else if (abs) {
      obs = ABSENCE_OBS[abs.status] || "Falta";
      if (abs.reason && !/^falta$/i.test(abs.reason.trim())) obs += ` — ${abs.reason}`;
      faltas++;
      if (abs.hasAttachment) {
        comprovativoUrl = `${base}/api/ponto/comprovativo/${abs.id}?token=${signPayslipToken(abs.id)}`;
      }
    } else if (isVacationDay(ds)) {
      obs = "Férias";
      ferias++;
    } else if (isHoliday(ds)) {
      obs = `Feriado — ${holidayName(ds) || ""}`.trim();
    } else if (isBridge(ds)) {
      obs = `Ponte — ${bridgeHolidayName(ds) || ""}`.trim();
    } else if (dow === 0 || dow === 6) {
      obs = "Fim de semana";
    }

    // Dia útil já passado (2.ª a 6.ª, não feriado/ponte/férias/fim de semana)
    // sem qualquer marcação: para colaboradores a tempo inteiro, conta como
    // falta injustificada. "Após passar a data": só os dias anteriores a hoje.
    if (obs === "" && !worked && !partTime && ds < today) {
      obs = "Falta injustificada";
      faltas++;
    }

    if (worked) {
      diasTrabalhados++;
      totalMin += min;
    }

    rows.push({
      day: d,
      mes: dm,
      dow,
      entrada: entrada ? hhmm(entrada) : "",
      saidaAlmoco: saidaAlmoco ? hhmm(saidaAlmoco) : "",
      regressoAlmoco: regresso ? hhmm(regresso) : "",
      saidaFinal: saidaFinal ? hhmm(saidaFinal) : "",
      saida: saidaFinal ? hhmm(saidaFinal) : saidaAlmoco ? hhmm(saidaAlmoco) : "",
      horas: worked ? formatMinutes(min) : "",
      worked,
      obs,
      comprovativoUrl,
    });
  }

  // Prémio de assiduidade e pontualidade: estado (qualificado ou não) e motivos.
  // O valor/qualificação seguem o recibo gerado (payslip); os motivos são
  // recalculados a partir dos registos para informação da contabilidade.
  const absInjustDays = userId
    ? await countBonusInjustifiedDays(userId, month, partTime)
    : absences.filter((a) => a.status === "INJUSTIFICADA").length;
  const delays: DelayInfo[] = punches
    .filter((p) => (p.lateMinutes ?? 0) > 5)
    .map((p) => ({
      lateMinutes: p.lateMinutes ?? 0,
      justified: !!(p.delayReason && p.delayReason.trim().length > 0),
    }));
  const bonusCalc = computeAttendanceBonus({ month, absInjustDays, delays });
  const bonus = {
    effective: bonusCalc.effective,
    qualified: payslip.premioQualificado,
    amount: payslip.premioAssiduidade || 0,
    reasons: payslip.premioQualificado ? [] : bonusCalc.reasons,
  };

  const buffer = await desenharAssiduidade({
    name: payslip.name,
    employeeNumber,
    category,
    month,
    rows,
    partTime,
    totals: { diasTrabalhados, totalMin, ferias, faltas },
    bonus,
  });
  const safeName = payslip.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `assiduidade-${safeName}-${month}.pdf`;
  return { buffer, filename };
}
