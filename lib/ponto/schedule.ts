// Horário de trabalho da empresa (Europe/Lisbon)
// Manhã: 09:00 - 13:00 | Pausa almoço: 13:00 - 14:30 | Tarde: 14:30 - 18:30

export const SCHEDULE = {
  morningStart: { h: 9, m: 0 },
  morningEnd: { h: 13, m: 0 },
  afternoonStart: { h: 14, m: 30 },
  afternoonEnd: { h: 18, m: 30 },
};

export const TIMEZONE = "Europe/Lisbon";

export type LisbonParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateStr: string; // YYYY-MM-DD
};

export function getLisbonParts(date: Date): LisbonParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get("minute"), 10);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
  return { year, month, day, hour, minute, dateStr };
}

export function minutesOfDay(parts: LisbonParts): number {
  return parts.hour * 60 + parts.minute;
}

function schedMinutes(s: { h: number; m: number }): number {
  return s.h * 60 + s.m;
}

// Calcula atraso (minutos) e horas extra (minutos) para uma marcação
export function computeDelays(
  type: string,
  date: Date
): { lateMinutes: number; extraMinutes: number } {
  const parts = getLisbonParts(date);
  const now = minutesOfDay(parts);
  let lateMinutes = 0;
  let extraMinutes = 0;

  switch (type) {
    case "ENTRADA":
      lateMinutes = Math.max(0, now - schedMinutes(SCHEDULE.morningStart));
      break;
    case "REGRESSO_ALMOCO":
      lateMinutes = Math.max(0, now - schedMinutes(SCHEDULE.afternoonStart));
      break;
    case "SAIDA_FINAL":
      extraMinutes = Math.max(0, now - schedMinutes(SCHEDULE.afternoonEnd));
      break;
    case "HORA_EXTRA":
      // marcação manual de hora extra a partir do fim do horário
      extraMinutes = Math.max(0, now - schedMinutes(SCHEDULE.afternoonEnd));
      break;
    default:
      break;
  }
  return { lateMinutes, extraMinutes };
}

export const PUNCH_LABELS: Record<string, string> = {
  ENTRADA: "Entrada ao serviço",
  SAIDA_ALMOCO: "Saída para almoço",
  REGRESSO_ALMOCO: "Regresso do almoço",
  SAIDA_FINAL: "Saída final",
  HORA_EXTRA: "Hora extra",
};

export const ABSENCE_LABELS: Record<string, string> = {
  POR_JUSTIFICAR: "Falta por justificar",
  EM_ANALISE: "Falta em análise",
  JUSTIFICADA: "Falta justificada",
  INJUSTIFICADA: "Falta injustificada",
};

// Sequência esperada de marcações
export const PUNCH_SEQUENCE = [
  "ENTRADA",
  "SAIDA_ALMOCO",
  "REGRESSO_ALMOCO",
  "SAIDA_FINAL",
];

export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total ?? 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// Calcula minutos trabalhados num dia a partir das marcações ordenadas.
// Suporta dois modos, deduzidos automaticamente das marcações:
//  • Dia completo (com pausa de almoço): entrada→saída almoço + regresso→saída.
//  • Sessão única (colaborador a tempo parcial ou dia sem pausa registada):
//    quando existe entrada e saída final mas nenhuma marcação de almoço, conta
//    o período contínuo entrada→saída final.
export function workedMinutesForDay(
  punches: { type: string; timestamp: Date }[]
): number {
  const byType = (t: string) =>
    punches.find((p) => p.type === t)?.timestamp ?? null;
  let total = 0;
  const entrada = byType("ENTRADA");
  const saidaAlmoco = byType("SAIDA_ALMOCO");
  const regresso = byType("REGRESSO_ALMOCO");
  const saidaFinal = byType("SAIDA_FINAL");

  const hasLunch = !!(saidaAlmoco || regresso);

  // Sessão única (part-time): entrada + saída final, sem marcações de almoço.
  if (!hasLunch && entrada && saidaFinal) {
    return Math.round(
      Math.max(0, (saidaFinal.getTime() - entrada.getTime()) / 60000)
    );
  }

  if (entrada && saidaAlmoco) {
    total += Math.max(
      0,
      (saidaAlmoco.getTime() - entrada.getTime()) / 60000
    );
  }
  if (regresso && saidaFinal) {
    total += Math.max(0, (saidaFinal.getTime() - regresso.getTime()) / 60000);
  }
  return Math.round(total);
}

// Itera as datas (YYYY-MM-DD) de start a end inclusive
export function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// Conta dias úteis (segunda a sexta) entre duas datas YYYY-MM-DD inclusive
export function countWeekdays(startDate: string, endDate: string): number {
  return eachDate(startDate, endDate).filter((ds) => {
    const [y, m, d] = ds.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo, 6=sábado
    return wd >= 1 && wd <= 5;
  }).length;
}

// Devolve só os dias úteis (segunda a sexta) entre duas datas
export function weekdaysBetween(startDate: string, endDate: string): string[] {
  return eachDate(startDate, endDate).filter((ds) => {
    const [y, m, d] = ds.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return wd >= 1 && wd <= 5;
  });
}
