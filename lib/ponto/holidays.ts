// Feriados nacionais de Portugal + dias de "ponte" automáticos.
//
// Regras de ponte pedidas pela empresa:
//  - Se o feriado cai à terça-feira, a segunda-feira anterior é ponte.
//  - Se o feriado cai à quinta-feira, a sexta-feira seguinte é ponte.
// Os dias de ponte são tratados como dias não úteis (marcados como férias
// para todos os colaboradores) e apresentados no calendário com cor distinta.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) — devolve {m, d}.
function easterSunday(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mth = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mth + 114) / 31); // 3=Março, 4=Abril
  const day = ((h + l - 7 * mth + 114) % 31) + 1;
  return { m: month, d: day };
}

function addDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

export type Holiday = { date: string; name: string };
export type BridgeDay = { date: string; holidayName: string };

// Lista de feriados nacionais (fixos + móveis) de Portugal para um dado ano.
export function getPortugalHolidays(year: number): Holiday[] {
  const list: Holiday[] = [
    { date: toStr(year, 1, 1), name: "Ano Novo" },
    { date: toStr(year, 4, 25), name: "Dia da Liberdade" },
    { date: toStr(year, 5, 1), name: "Dia do Trabalhador" },
    { date: toStr(year, 6, 10), name: "Dia de Portugal" },
    { date: toStr(year, 8, 15), name: "Assunção de Nossa Senhora" },
    { date: toStr(year, 10, 5), name: "Implantação da República" },
    { date: toStr(year, 11, 1), name: "Todos os Santos" },
    { date: toStr(year, 12, 1), name: "Restauração da Independência" },
    { date: toStr(year, 12, 8), name: "Imaculada Conceição" },
    { date: toStr(year, 12, 25), name: "Natal" },
  ];

  // Feriados móveis baseados na Páscoa.
  const easter = easterSunday(year);
  const goodFriday = addDays(year, easter.m, easter.d, -2);
  const corpusChristi = addDays(year, easter.m, easter.d, 60);
  const carnival = addDays(year, easter.m, easter.d, -47); // terça-feira de Carnaval

  list.push({ date: toStr(goodFriday.y, goodFriday.m, goodFriday.d), name: "Sexta-feira Santa" });
  list.push({ date: toStr(year, easter.m, easter.d), name: "Páscoa" });
  list.push({ date: toStr(corpusChristi.y, corpusChristi.m, corpusChristi.d), name: "Corpo de Deus" });
  list.push({ date: toStr(carnival.y, carnival.m, carnival.d), name: "Carnaval" });

  return list;
}

function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom .. 6=Sáb
}

// Conjunto de datas de feriado (para pesquisa rápida) de um ano.
function holidaySet(year: number): Set<string> {
  return new Set(getPortugalHolidays(year).map((h) => h.date));
}

// Calcula os dias de ponte de um ano segundo as regras da empresa.
export function getBridgeDays(year: number): BridgeDay[] {
  const holidays = getPortugalHolidays(year);
  const hSet = holidaySet(year);
  const bridges: BridgeDay[] = [];

  for (const h of holidays) {
    const dow = dowOf(h.date);
    const [y, m, d] = h.date.split("-").map((x) => parseInt(x, 10));
    let bridge: { y: number; m: number; d: number } | null = null;

    if (dow === 2) {
      // Feriado à terça → segunda-feira anterior é ponte.
      bridge = addDays(y, m, d, -1);
    } else if (dow === 4) {
      // Feriado à quinta → sexta-feira seguinte é ponte.
      bridge = addDays(y, m, d, 1);
    }

    if (bridge) {
      const bStr = toStr(bridge.y, bridge.m, bridge.d);
      const bDow = dowOf(bStr);
      // Não marcar como ponte se já for feriado ou fim-de-semana.
      if (!hSet.has(bStr) && bDow >= 1 && bDow <= 5) {
        bridges.push({ date: bStr, holidayName: h.name });
      }
    }
  }

  return bridges;
}

// Mapa acumulado ano→dados, evitando recalcular repetidamente.
const _cache = new Map<number, { holidays: Set<string>; bridges: Map<string, string> }>();

function yearData(year: number) {
  let entry = _cache.get(year);
  if (!entry) {
    const holidays = holidaySet(year);
    const bridges = new Map<string, string>();
    for (const b of getBridgeDays(year)) bridges.set(b.date, b.holidayName);
    entry = { holidays, bridges };
    _cache.set(year, entry);
  }
  return entry;
}

function yearOf(dateStr: string): number {
  return parseInt((dateStr ?? "").slice(0, 4), 10);
}

export function isHoliday(dateStr: string): boolean {
  const y = yearOf(dateStr);
  if (!y) return false;
  return yearData(y).holidays.has(dateStr);
}

export function isBridge(dateStr: string): boolean {
  const y = yearOf(dateStr);
  if (!y) return false;
  return yearData(y).bridges.has(dateStr);
}

export function holidayName(dateStr: string): string | null {
  const y = yearOf(dateStr);
  if (!y) return null;
  const h = getPortugalHolidays(y).find((x) => x.date === dateStr);
  return h ? h.name : null;
}

export function bridgeHolidayName(dateStr: string): string | null {
  const y = yearOf(dateStr);
  if (!y) return null;
  return yearData(y).bridges.get(dateStr) ?? null;
}

// Dias não úteis por feriado/ponte de um mês "AAAA-MM" (apenas dias de semana).
export function nonWorkingInfoForMonth(
  month: string
): { holidays: Set<number>; bridges: Set<number> } {
  const [y, m] = (month ?? "").split("-").map((x) => parseInt(x, 10));
  const holidays = new Set<number>();
  const bridges = new Set<number>();
  if (!y || !m) return { holidays, bridges };
  const data = yearData(y);
  const prefix = `${y}-${pad(m)}-`;
  data.holidays.forEach((dStr) => {
    if (dStr.startsWith(prefix)) holidays.add(parseInt(dStr.slice(8, 10), 10));
  });
  data.bridges.forEach((_name, dStr) => {
    if (dStr.startsWith(prefix)) bridges.add(parseInt(dStr.slice(8, 10), 10));
  });
  return { holidays, bridges };
}
