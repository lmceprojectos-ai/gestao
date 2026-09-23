// Geração do registo de assiduidade mensal em PDF (para a contabilidade).
// Mostra, dia a dia, as marcações de ponto de cada colaborador — incluindo
// a hora de saída/regresso do almoço — bem como férias, faltas e feriados.
// Reutiliza a conversão HTML→PDF e a assinatura de tokens do módulo do recibo.

import { prisma } from "@/lib/db";
import { COMPANY, renderPayslipPdf, signPayslipToken } from "@/lib/ponto/payslip-pdf";
import { workedMinutesForDay, formatMinutes } from "@/lib/ponto/schedule";
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

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

type DayRow = {
  day: number;
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

// ── Construção do HTML do registo de assiduidade ──────────────────────────
export function buildAttendanceHtml(opts: {
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
}): string {
  const [yStr, mStr] = opts.month.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const monthName = m >= 1 && m <= 12 ? MESES[m - 1] : opts.month;

  const partTime = !!opts.partTime;
  // Num colaborador a tempo parcial, se houver pelo menos um dia com pausa de
  // almoço registada (dia completo), incluímos também as colunas de almoço para
  // que esses dias mostrem a saída e o regresso do almoço. Caso contrário, usa-se
  // o formato compacto (apenas Entrada e Saída).
  const partTimeHasLunch =
    partTime && opts.rows.some((r) => r.saidaAlmoco || r.regressoAlmoco);
  const partTimeCompact = partTime && !partTimeHasLunch;
  const bodyRows = opts.rows
    .map((r) => {
      const weekend = r.dow === 0 || r.dow === 6;
      const shade = weekend || (!r.worked && r.obs) ? "background:#f3f4f6;" : "";
      const obsColor = /Falta injustificada/i.test(r.obs)
        ? "color:#b91c1c;font-weight:bold;"
        : /Férias|Feriado|Ponte|Falta/i.test(r.obs)
        ? "color:#1d4ed8;"
        : "";
      const obsCell = `<td class="o" style="${obsColor}">${esc(r.obs)}${
        r.comprovativoUrl
          ? `<br><a href="${r.comprovativoUrl}" style="color:#b45309;font-weight:600;text-decoration:underline;">Ver comprovativo</a>`
          : ""
      }</td>`;
      if (partTimeCompact) {
        return `<tr style="${shade}">
        <td class="d">${pad(r.day)} ${DOW[r.dow]}</td>
        <td class="h">${r.entrada || "—"}</td>
        <td class="h">${r.saida || "—"}</td>
        <td class="h">${r.horas || ""}</td>
        ${obsCell}
      </tr>`;
      }
      if (partTimeHasLunch) {
        return `<tr style="${shade}">
        <td class="d">${pad(r.day)} ${DOW[r.dow]}</td>
        <td class="h">${r.entrada || "—"}</td>
        <td class="h">${r.saidaAlmoco || "—"}</td>
        <td class="h">${r.regressoAlmoco || "—"}</td>
        <td class="h">${r.saida || "—"}</td>
        <td class="h">${r.horas || ""}</td>
        ${obsCell}
      </tr>`;
      }
      return `<tr style="${shade}">
        <td class="d">${pad(r.day)} ${DOW[r.dow]}</td>
        <td class="h">${r.entrada || "—"}</td>
        <td class="h">${r.saidaAlmoco || "—"}</td>
        <td class="h">${r.regressoAlmoco || "—"}</td>
        <td class="h">${r.saidaFinal || "—"}</td>
        <td class="h">${r.horas || ""}</td>
        ${obsCell}
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111827; font-size:12px; }
  .wrap { padding: 6px 16px; }
  .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #feca00; padding-bottom:8px; margin-bottom:10px; }
  .company { font-size:17px; font-weight:bold; }
  .company .sub { font-size:11px; font-weight:normal; color:#6b7280; }
  .title { text-align:right; font-size:13px; font-weight:bold; }
  .title .mono { font-size:11px; font-weight:normal; color:#6b7280; }
  .emp { margin:6px 0 12px; font-size:12px; }
  .emp strong { font-size:13px; }
  table.grid { border-collapse:collapse; width:100%; }
  table.grid th { background:#feca00; color:#1f2937; font-size:11px; padding:6px 6px; border:1px solid #e5b800; text-align:center; }
  table.grid td { border:1px solid #e5e7eb; padding:4px 6px; font-size:11px; }
  table.grid td.d { text-align:left; white-space:nowrap; }
  table.grid td.h { text-align:center; }
  table.grid td.o { text-align:left; color:#374151; }
  .tots { margin-top:12px; width:100%; border-collapse:collapse; }
  .tots td { padding:6px 10px; font-size:12px; border:1px solid #e5e7eb; }
  .tots .lbl { color:#6b7280; }
  .tots .val { font-weight:bold; text-align:right; }
  .foot { margin-top:14px; color:#9ca3af; font-size:10px; }
</style></head>
<body><div class="wrap">

  <div class="head">
    <div class="company">${esc(COMPANY.name)}<div class="sub">NIF ${esc(COMPANY.nif)} · Livro de Ponto</div></div>
    <div class="title">REGISTO DE ASSIDUIDADE<div class="mono">${monthName} de ${y}</div></div>
  </div>

  <div class="emp">
    ${opts.employeeNumber ? `<span style="color:#6b7280;margin-right:10px;">N.º ${esc(opts.employeeNumber)}</span>` : ""}
    <strong>${esc(opts.name)}</strong>${opts.category ? ` — ${esc(opts.category)}` : ""}
  </div>

  <table class="grid">
    <thead>
      <tr>
      ${
        partTimeCompact
          ? `<th style="width:16%;">Dia</th>
        <th style="width:17%;">Entrada</th>
        <th style="width:17%;">Saída</th>
        <th style="width:14%;">Horas</th>
        <th style="width:36%;">Observações</th>`
          : partTimeHasLunch
          ? `<th style="width:13%;">Dia</th>
        <th style="width:13%;">Entrada</th>
        <th style="width:14%;">Saída almoço</th>
        <th style="width:15%;">Regresso almoço</th>
        <th style="width:13%;">Saída</th>
        <th style="width:12%;">Horas</th>
        <th style="width:20%;">Observações</th>`
          : `<th style="width:13%;">Dia</th>
        <th style="width:13%;">Entrada</th>
        <th style="width:14%;">Saída almoço</th>
        <th style="width:15%;">Regresso almoço</th>
        <th style="width:13%;">Saída final</th>
        <th style="width:12%;">Horas</th>
        <th style="width:20%;">Observações</th>`
      }
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <table class="tots">
    <tr>
      <td class="lbl">Dias trabalhados</td><td class="val">${opts.totals.diasTrabalhados}</td>
      <td class="lbl">Total de horas</td><td class="val">${formatMinutes(opts.totals.totalMin)}</td>
      <td class="lbl">Dias de férias</td><td class="val">${opts.totals.ferias}</td>
      <td class="lbl">Faltas</td><td class="val">${opts.totals.faltas}</td>
    </tr>
  </table>

  ${
    opts.bonus && opts.bonus.effective
      ? `<table class="tots" style="margin-top:8px;">
    <tr>
      <td class="lbl" style="width:34%;">Prémio de assiduidade e pontualidade</td>
      <td style="font-weight:bold;${opts.bonus.qualified ? "color:#15803d;" : "color:#b91c1c;"}">${
          opts.bonus.qualified
            ? `QUALIFICADO — ${eur(opts.bonus.amount)}`
            : "NÃO QUALIFICADO"
        }</td>
    </tr>${
      !opts.bonus.qualified && opts.bonus.reasons.length
        ? `
    <tr><td class="lbl" style="vertical-align:top;">Motivo(s)</td><td style="color:#6b7280;">${opts.bonus.reasons
            .map((r) => esc(r))
            .join("<br>")}</td></tr>`
        : ""
    }
  </table>`
      : ""
  }

  <div class="foot">Documento gerado automaticamente a partir dos registos de ponto. Horas calculadas com base nas marcações de entrada/saída.</div>

</div></body></html>`;
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
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${pad(m)}-01`;
  const to = `${y}-${pad(m)}-${pad(lastDay)}`;

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

  for (let d = 1; d <= lastDay; d++) {
    const ds = `${y}-${pad(m)}-${pad(d)}`;
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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

  const html = buildAttendanceHtml({
    name: payslip.name,
    employeeNumber,
    category,
    month,
    rows,
    partTime,
    totals: { diasTrabalhados, totalMin, ferias, faltas },
    bonus,
  });
  const buffer = await renderPayslipPdf(html);
  const safeName = payslip.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `assiduidade-${safeName}-${month}.pdf`;
  return { buffer, filename };
}
