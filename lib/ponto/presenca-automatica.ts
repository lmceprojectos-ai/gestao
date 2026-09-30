// Presença automática: para os colaboradores escolhidos pelo administrador, todos
// os dias úteis (segunda a sexta) ficam com o dia completo marcado — entrada 09:00,
// almoço 13:00–14:30 e saída 18:30 — a partir da data em que a opção foi ligada.
// Não marca feriados, pontes, férias aprovadas, dias com falta registada nem dias
// que já tenham marcações. Guarda-se nas definições (Setting), sem mudar a base de dados.
import { prisma } from "@/lib/db";
import { weekdaysBetween } from "@/lib/ponto/schedule";
import { isHoliday, isBridge } from "@/lib/ponto/holidays";
import { todayStr } from "@/lib/ponto/format";

const CHAVE = "presenca_automatica"; // JSON { [userId]: "AAAA-MM-DD" (desde) }
export const NOTA_AUTOMATICA = "Presença automática (dias úteis)";

const MARCACOES = [
  { type: "ENTRADA", h: 9, m: 0 },
  { type: "SAIDA_ALMOCO", h: 13, m: 0 },
  { type: "REGRESSO_ALMOCO", h: 14, m: 30 },
  { type: "SAIDA_FINAL", h: 18, m: 30 },
] as const;

// Hora de Lisboa → instante UTC (tem em conta a hora de verão).
function lisbonDate(dateStr: string, h: number, m: number): Date {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, m, 0);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(guess));
  const lh = Number(parts.find((p) => p.type === "hour")?.value ?? h) % 24;
  const lm = Number(parts.find((p) => p.type === "minute")?.value ?? m);
  const offset = (lh * 60 + lm) - (h * 60 + m);
  return new Date(guess - offset * 60000);
}

export async function lerPresencaAutomatica(): Promise<Record<string, string>> {
  const s = await prisma.setting.findUnique({ where: { key: CHAVE } }).catch(() => null);
  if (!s?.value) return {};
  try {
    const v = JSON.parse(s.value);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export async function definirPresencaAutomatica(userId: string, ativo: boolean) {
  const atual = await lerPresencaAutomatica();
  if (ativo) atual[userId] = atual[userId] || todayStr();
  else delete atual[userId];
  const value = JSON.stringify(atual);
  await prisma.setting.upsert({ where: { key: CHAVE }, create: { key: CHAVE, value }, update: { value } });
  if (ativo) await aplicarPresencaAutomatica(true);
}

let ultimaVez = 0;

// Cria as marcações em falta até hoje. Os ids são fixos por colaborador/dia/marcação,
// por isso correr várias vezes (ou em paralelo) nunca duplica.
export async function aplicarPresencaAutomatica(forcar = false): Promise<number> {
  if (!forcar && Date.now() - ultimaVez < 60_000) return 0;
  ultimaVez = Date.now();
  const cfg = await lerPresencaAutomatica();
  const hoje = todayStr();
  let criadas = 0;
  for (const [userId, desde] of Object.entries(cfg)) {
    if (!desde || desde > hoje) continue;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
    if (!u?.active) continue;
    const dias = weekdaysBetween(desde, hoje).filter((d) => !isHoliday(d) && !isBridge(d));
    if (!dias.length) continue;
    const [comMarcacao, faltas, ferias] = await Promise.all([
      prisma.timeRecord.findMany({ where: { userId, workDate: { gte: desde, lte: hoje } }, select: { workDate: true }, distinct: ["workDate"] }),
      prisma.absence.findMany({ where: { userId, absenceDate: { gte: desde, lte: hoje } }, select: { absenceDate: true } }),
      prisma.vacationRequest.findMany({ where: { userId, status: "APROVADA" }, select: { startDate: true, endDate: true } }),
    ]);
    const ocupados = new Set([...comMarcacao.map((r) => r.workDate), ...faltas.map((a) => a.absenceDate)]);
    const emFerias = (d: string) => ferias.some((v) => d >= v.startDate && d <= v.endDate);
    const data = dias
      .filter((d) => !ocupados.has(d) && !emFerias(d))
      .flatMap((d) =>
        MARCACOES.map((p, i) => ({
          id: `auto-${userId}-${d}-${i}`,
          userId,
          type: p.type,
          timestamp: lisbonDate(d, p.h, p.m),
          workDate: d,
          ipAddress: "automatico",
          device: "Presença automática",
          lateMinutes: 0,
          extraMinutes: 0,
          note: NOTA_AUTOMATICA,
        }))
      );
    if (data.length) criadas += (await prisma.timeRecord.createMany({ data: data as any, skipDuplicates: true })).count;
  }
  return criadas;
}
