// Lógica de cálculo de vencimentos (payroll).
// Os perfis salariais são aprendidos uma vez a partir do PDF de recibos e,
// mensalmente, os recibos são gerados automaticamente a partir do calendário
// de pontos (faltas justificadas e injustificadas descontam proporcionalmente).

import type { PayslipEntry } from "@/lib/ponto/payslip";
import { isHoliday, isBridge } from "@/lib/ponto/holidays";

export function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

// Nº de dias úteis (2ª a 6ª) num mês "AAAA-MM".
export function workingDaysInMonth(month: string): number {
  const [y, m] = (month ?? "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return 0;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom .. 6=Sáb
    if (dow < 1 || dow > 5) continue;
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isHoliday(dateStr) || isBridge(dateStr)) continue;
    count++;
  }
  return count;
}

// Lista de dias úteis (strings "AAAA-MM-DD") de um mês, opcionalmente até um dia limite (inclusive).
export function workingDayList(month: string, uptoDay?: number): string[] {
  const [y, m] = (month ?? "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return [];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const limit = uptoDay && uptoDay > 0 ? Math.min(uptoDay, days) : days;
  const out: string[] = [];
  for (let d = 1; d <= limit; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow < 1 || dow > 5) continue;
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isHoliday(dateStr) || isBridge(dateStr)) continue;
    out.push(dateStr);
  }
  return out;
}

export type SalaryProfileInput = {
  vencimentoBase: number;
  mealPerDay: number;
  subsFerias: number;
  subsNatal: number;
  ssRate: number;
  irsRate: number;
};

// A partir de uma entrada extraída do PDF (valores de um mês de referência),
// deriva o perfil salarial reutilizável.
export function deriveProfile(entry: PayslipEntry, refMonth: string): SalaryProfileInput {
  const wd = workingDaysInMonth(refMonth) || 22;
  const venc = entry.vencimentoBase || entry.salarioBase || 0;
  // Base de incidência de SS/IRS: vencimento + subsídios (alimentação isenta).
  const baseIncidencia = venc + (entry.subsFerias || 0) + (entry.subsNatal || 0);
  const mealPerDay = wd > 0 ? round2((entry.subsAlimentacao || 0) / wd) : 0;
  const ssRate =
    baseIncidencia > 0 && entry.segSocial
      ? round2((entry.segSocial / baseIncidencia) * 10000) / 10000
      : 0.11;
  const irsRate =
    baseIncidencia > 0 && entry.irs
      ? round2((entry.irs / baseIncidencia) * 10000) / 10000
      : 0;
  return {
    vencimentoBase: round2(venc),
    mealPerDay,
    subsFerias: round2(entry.subsFerias || 0),
    subsNatal: round2(entry.subsNatal || 0),
    ssRate,
    irsRate,
  };
}

export type ComputeResult = {
  vencimentoBase: number;
  subsAlimentacao: number;
  subsFerias: number;
  subsNatal: number;
  premioAssiduidade: number;
  totalFaltas: number;
  segSocial: number;
  irs: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
};

// Calcula o recibo de um colaborador para um mês, com base no perfil salarial
// e nos dias efetivamente trabalhados (derivados dos pontos).
// - O vencimento base é SEMPRE o valor fixo do perfil e NÃO depende do
//   calendário/dias trabalhados: as faltas NÃO reduzem o vencimento base.
//   (As faltas continuam a afetar apenas a qualificação do prémio de
//   assiduidade, tratado à parte.)
// - Subsídios de férias e Natal são pagos em duodécimos (todos os meses).
// - O subsídio de alimentação é pago por dia efetivamente trabalhado.
// - SS e IRS incidem sobre vencimento + subsídios (alimentação isenta).
export function computePayslip(
  profile: SalaryProfileInput,
  opts: {
    workingDays: number;
    daysWorked: number;
    // Dias que conferem subsídio de alimentação (presença física). Se não for
    // indicado, assume-se igual a daysWorked. Dias de férias são pagos (contam
    // para daysWorked) mas não recebem subsídio de alimentação.
    mealDays?: number;
    premioAssiduidade?: number;
    // Vencimento base já calculado (colaboradores a tempo parcial pagos por
    // meio período). Quando indicado, substitui o cálculo proporcional e não há
    // desconto por faltas sobre o vencimento.
    baseOverride?: number;
  }
): ComputeResult {
  const workingDays = opts.workingDays > 0 ? opts.workingDays : 1;
  const daysWorked = Math.max(0, Math.min(opts.daysWorked, workingDays));
  const mealDays = Math.max(0, Math.min(opts.mealDays ?? daysWorked, workingDays));

  const vencFull = profile.vencimentoBase;
  const hasOverride = typeof opts.baseOverride === "number";
  // O vencimento base é sempre fixo (valor do perfil), independentemente dos
  // dias trabalhados. Não há desconto de faltas sobre o vencimento base.
  const vencimentoBase = hasOverride
    ? round2(Math.max(0, opts.baseOverride as number))
    : round2(vencFull);
  const faltasValor = 0; // as faltas não reduzem o vencimento base
  const subsAlimentacao = round2(profile.mealPerDay * mealDays);
  const subsFerias = round2(profile.subsFerias);
  const subsNatal = round2(profile.subsNatal);
  // Prémio de assiduidade e pontualidade (linha discriminada; sujeito a IRS/SS,
  // mas não conta para férias/Natal).
  const premioAssiduidade = round2(Math.max(0, opts.premioAssiduidade ?? 0));

  const totalIliquido = round2(
    vencimentoBase + subsAlimentacao + subsFerias + subsNatal + premioAssiduidade
  );

  // Alimentação isenta; o prémio está sujeito a SS/IRS.
  const baseIncidencia = vencimentoBase + subsFerias + subsNatal + premioAssiduidade;
  const segSocial = round2(profile.ssRate * baseIncidencia);
  const irs = round2(profile.irsRate * baseIncidencia);
  const totalDescontos = round2(segSocial + irs);
  const liquido = round2(totalIliquido - totalDescontos);

  return {
    vencimentoBase,
    subsAlimentacao,
    subsFerias,
    subsNatal,
    premioAssiduidade,
    totalFaltas: faltasValor,
    segSocial,
    irs,
    totalIliquido,
    totalDescontos,
    liquido,
  };
}
