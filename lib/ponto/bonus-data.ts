import { prisma } from "@/lib/db";
import {
  computeAttendanceBonus,
  type BonusResult,
  type DelayInfo,
} from "@/lib/ponto/bonus";
import { workingDayList } from "@/lib/ponto/payroll";
import { getLisbonParts } from "@/lib/ponto/schedule";

// Determina se uma falta representa, na verdade, um dia de férias (motivo ou
// observação com "férias"). Esses dias não contam como falta injustificada.
function isFeriasAbsence(a: {
  reason?: string | null;
  observation?: string | null;
}): boolean {
  const s = `${a?.reason ?? ""} ${a?.observation ?? ""}`.toLowerCase();
  return s.includes("féri") || s.includes("feri");
}

// Conta as faltas injustificadas de um colaborador num mês, PARA EFEITOS DE
// PRÉMIO de assiduidade.
//
//  - Tempo parcial (partTime=true): não têm horário fixo diário, por isso só
//    contam as faltas registadas manualmente como INJUSTIFICADA (excluindo as
//    que são, na verdade, férias).
//  - Tempo inteiro (partTime=false): além das faltas INJUSTIFICADAS registadas,
//    cada dia útil passado (2.ª a 6.ª, excluindo feriados e pontes) SEM marcação
//    de entrada, que não seja férias aprovadas nem tenha falta justificada / em
//    análise, conta como falta injustificada (inclui os dias em branco no mapa
//    de picagens). Para o mês corrente só se consideram os dias já passados.
export async function countBonusInjustifiedDays(
  userId: string,
  month: string,
  partTime: boolean
): Promise<number> {
  const absences = await prisma.absence.findMany({
    where: { userId, absenceDate: { startsWith: `${month}-` } },
    select: { absenceDate: true, status: true, reason: true, observation: true },
  });

  if (partTime) {
    return absences.filter(
      (a) => a.status === "INJUSTIFICADA" && !isFeriasAbsence(a)
    ).length;
  }

  // Tempo inteiro: considera os dias úteis JÁ PASSADOS sem marcação de entrada.
  // "Após passar a data": o dia de hoje só conta depois de passar, por isso
  // consideram-se apenas os dias estritamente anteriores a hoje.
  const now = getLisbonParts(new Date());
  const curMonth = `${now.year}-${String(now.month).padStart(2, "0")}`;
  let pastWorkingDays: string[];
  if (month === curMonth) {
    const upto = now.day - 1; // exclui o dia de hoje
    pastWorkingDays = upto >= 1 ? workingDayList(month, upto) : [];
  } else {
    pastWorkingDays = workingDayList(month);
  }
  if (pastWorkingDays.length === 0) return 0;

  const [entradas, vacs] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { userId, type: "ENTRADA", workDate: { startsWith: `${month}-` } },
      select: { workDate: true },
    }),
    prisma.vacationRequest.findMany({
      where: { userId, status: "APROVADA" },
      select: { startDate: true, endDate: true },
    }),
  ]);
  const entradaDates = new Set(entradas.map((e) => e.workDate));

  const vacationDaysSet = new Set<string>();
  for (const v of vacs) {
    for (const d of pastWorkingDays) {
      if (d >= v.startDate && d <= v.endDate) vacationDaysSet.add(d);
    }
  }
  // Faltas que são, na verdade, férias também contam como dia de férias.
  for (const a of absences) {
    if (isFeriasAbsence(a) && pastWorkingDays.includes(a.absenceDate)) {
      vacationDaysSet.add(a.absenceDate);
    }
  }

  // Dias com falta justificada / em análise (que não sejam férias) — pagos.
  const justifiedDates = new Set(
    absences
      .filter(
        (a) =>
          (a.status === "JUSTIFICADA" || a.status === "EM_ANALISE") &&
          !isFeriasAbsence(a)
      )
      .map((a) => a.absenceDate)
  );

  let injust = 0;
  for (const d of pastWorkingDays) {
    if (entradaDates.has(d)) continue;
    if (vacationDaysSet.has(d) || justifiedDates.has(d)) continue;
    injust++;
  }
  return injust;
}

// Recolhe os dados de assiduidade/pontualidade de um colaborador num mês
// (a partir dos registos de ponto) e calcula a qualificação para o prémio.
export async function computeUserBonusForMonth(
  userId: string,
  month: string
): Promise<BonusResult> {
  const [user, latePunches, taskMisses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { partTime: true },
    }),
    prisma.timeRecord.findMany({
      where: {
        userId,
        workDate: { startsWith: `${month}-` },
        lateMinutes: { gt: 5 },
      },
      select: { lateMinutes: true, delayReason: true },
    }),
    prisma.dailyTaskMiss.count({
      where: { userId, missDate: { startsWith: `${month}-` } },
    }),
  ]);

  const absInjustDays = await countBonusInjustifiedDays(
    userId,
    month,
    !!user?.partTime
  );
  const delays: DelayInfo[] = latePunches.map((r) => ({
    lateMinutes: r.lateMinutes ?? 0,
    justified: !!(r.delayReason && r.delayReason.trim().length > 0),
  }));

  return computeAttendanceBonus({ month, absInjustDays, delays, taskMisses });
}
