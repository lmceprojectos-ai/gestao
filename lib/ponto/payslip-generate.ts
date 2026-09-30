// Geração automática de recibos a partir dos perfis salariais e do calendário
// de pontos. Reutilizado pela API do admin e pela tarefa agendada mensal.

import { prisma } from "@/lib/db";
import { getLisbonParts, workedMinutesForDay } from "@/lib/ponto/schedule";
import {
  workingDaysInMonth,
  workingDayList,
  computePayslip,
  type SalaryProfileInput,
} from "@/lib/ponto/payroll";
import { computeAttendanceBonus, type DelayInfo } from "@/lib/ponto/bonus";
import { countBonusInjustifiedDays } from "@/lib/ponto/bonus-data";
import { aplicarPresencaAutomatica } from "@/lib/ponto/presenca-automatica";

export type GeneratedRow = {
  name: string;
  workingDays: number;
  daysWorked: number;
  absJustDays: number;
  absInjustDays: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
};

// Gera (ou atualiza) os recibos de todos os perfis salariais para um mês.
// Para o mês corrente, os dias posteriores ao dia atual são assumidos como
// trabalhados; as faltas são os dias úteis passados sem marcação de entrada.
export async function generatePayslipsForMonth(
  month: string,
  opts?: { userId?: string }
): Promise<{ month: string; rows: GeneratedRow[] }> {
  // Dias úteis de quem tem presença automática ficam marcados antes de calcular.
  await aplicarPresencaAutomatica(true).catch((e) => console.error("Presença automática:", e));
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Mês inválido");
  }

  const profiles = await prisma.salaryProfile.findMany({
    where: opts?.userId ? { userId: opts.userId } : undefined,
    include: { user: { select: { partTime: true } } },
  });
  const workingDays = workingDaysInMonth(month);
  const allWorkingDays = workingDayList(month); // dias úteis do mês completo

  // Determina o limite de dias a considerar como "passados".
  const now = getLisbonParts(new Date());
  const curMonth = `${now.year}-${String(now.month).padStart(2, "0")}`;
  const isCurrentMonth = month === curMonth;
  const uptoDay = isCurrentMonth ? now.day : undefined; // undefined = mês completo
  const pastWorkingDays = workingDayList(month, uptoDay);
  const pastSet = new Set(pastWorkingDays);
  // Dias úteis ainda por vir no mês corrente (assumidos como trabalhados).
  const futureWorkingDaysList = allWorkingDays.filter((d) => !pastSet.has(d));

  const rows: GeneratedRow[] = [];

  for (const profile of profiles) {
    let unpaidAbsenceDays = 0; // faltas não pagas (reduzem o vencimento)
    let physicalPastDays = 0; // dias úteis passados com presença física (marcação)
    let futureVacationDays = 0; // dias de férias no período futuro assumido
    let absJustDays = 0;
    let absInjustDays = 0;
    let feriasDays = 0; // dias de férias aprovadas no mês
    // Colaboradores a tempo parcial são pagos por meio período (manhã/tarde).
    const isPartTime = !!profile.user?.partTime;
    let partTimePeriods = 0; // nº de meios períodos trabalhados (dia completo = 2)
    let partTimeDaysWorked = 0; // dias distintos com marcação

    if (profile.userId) {
      // Dias de férias APROVADAS que caem neste mês. São dias pagos (não são
      // faltas), mas não conferem subsídio de alimentação.
      const vacs = await prisma.vacationRequest.findMany({
        where: { userId: profile.userId, status: "APROVADA" },
        select: { startDate: true, endDate: true },
      });
      const vacationDaysSet = new Set<string>();
      for (const v of vacs) {
        for (const d of allWorkingDays) {
          if (d >= v.startDate && d <= v.endDate) vacationDaysSet.add(d);
        }
      }

      // Faltas registadas no mês (com estado). As faltas justificadas ou em
      // análise são dias pagos (não reduzem o vencimento); as injustificadas ou
      // por justificar reduzem-no proporcionalmente. Tal como as férias, uma
      // falta justificada não confere subsídio de alimentação.
      const absences = await prisma.absence.findMany({
        where: { userId: profile.userId, absenceDate: { startsWith: `${month}-` } },
        select: { absenceDate: true, status: true, reason: true, observation: true },
      });
      // Algumas faltas representam, na verdade, dias de férias (motivo/observação
      // com "férias"). Esses dias devem contar APENAS como férias — nunca como
      // faltas justificadas — para não serem contados duas vezes.
      const isFeriasAbsence = (a: { reason?: string | null; observation?: string | null }) => {
        const s = `${a?.reason ?? ""} ${a?.observation ?? ""}`.toLowerCase();
        return s.includes("féri") || s.includes("feri");
      };
      for (const a of absences) {
        if (isFeriasAbsence(a) && allWorkingDays.includes(a.absenceDate)) {
          vacationDaysSet.add(a.absenceDate); // trata a falta de férias como dia de férias
        }
      }
      feriasDays = vacationDaysSet.size;

      // Faltas justificadas = justificadas/em análise que NÃO são férias.
      const justifiedDates = new Set(
        absences
          .filter((a) => (a.status === "JUSTIFICADA" || a.status === "EM_ANALISE") && !isFeriasAbsence(a))
          .filter((a) => !vacationDaysSet.has(a.absenceDate))
          .map((a) => a.absenceDate)
      );
      absJustDays = justifiedDates.size;
      absInjustDays = absences.filter((a) => a.status === "INJUSTIFICADA" && !isFeriasAbsence(a)).length;

      // Dias úteis passados COM marcação de entrada.
      const entradas = await prisma.timeRecord.findMany({
        where: {
          userId: profile.userId,
          type: "ENTRADA",
          workDate: { startsWith: `${month}-` },
        },
        select: { workDate: true },
      });
      const entradaDates = new Set(entradas.map((e) => e.workDate));

      // Tempo parcial: conta meios períodos a partir das HORAS trabalhadas em
      // cada dia. Um dia com >= 8 horas trabalhadas conta como dia completo
      // (2 períodos = manhã + tarde); um dia com menos de 8 horas conta como
      // meio período (1). As horas são calculadas a partir das marcações.
      if (isPartTime) {
        const FULL_DAY_MINUTES = 8 * 60; // 8 horas
        // Ciclo de vencimento 26 → 25: o recibo de um mês cobre o período que
        // vai do dia 26 do mês anterior até ao dia 25 deste mês (inclusive). Os
        // dias trabalhados após o dia 25 não se perdem — passam a contar para o
        // recibo do mês seguinte. Cada meio período (manhã ou tarde) é pago ao
        // valor por período do perfil; um dia completo (>= 8 horas) conta como
        // 2 períodos.
        const [wy, wm] = month.split("-").map((x) => parseInt(x, 10));
        const prev = new Date(Date.UTC(wy, wm - 1, 1));
        prev.setUTCMonth(prev.getUTCMonth() - 1);
        const prevMonth = `${prev.getUTCFullYear()}-${String(
          prev.getUTCMonth() + 1
        ).padStart(2, "0")}`;
        const periodStart = `${prevMonth}-26`; // dia 26 do mês anterior
        const periodEnd = `${month}-25`; // dia 25 deste mês
        const dayPunches = await prisma.timeRecord.findMany({
          where: {
            userId: profile.userId,
            workDate: { gte: periodStart, lte: periodEnd },
          },
          select: { workDate: true, type: true, timestamp: true },
          orderBy: { timestamp: "asc" },
        });
        const punchesByDay = new Map<string, { type: string; timestamp: Date }[]>();
        const ptEntradaDays = new Set<string>();
        for (const r of dayPunches) {
          if (!punchesByDay.has(r.workDate)) punchesByDay.set(r.workDate, []);
          punchesByDay.get(r.workDate)!.push({ type: r.type, timestamp: r.timestamp });
          if (r.type === "ENTRADA") ptEntradaDays.add(r.workDate);
        }
        // A partir do recibo de outubro de 2026, um dia sem horas contadas (por
        // exemplo, só com a entrada marcada) não conta: não se assume meio período.
        const semHorasNaoConta = month >= "2026-10";
        for (const d of Array.from(ptEntradaDays)) {
          const minutes = workedMinutesForDay(punchesByDay.get(d) ?? []);
          if (semHorasNaoConta && minutes <= 0) continue;
          partTimeDaysWorked++;
          partTimePeriods += minutes >= FULL_DAY_MINUTES ? 2 : 1;
        }
      }

      // Classifica cada dia útil passado: presença física (marcação), dia pago
      // sem presença (férias/falta justificada) ou falta não paga.
      for (const d of pastWorkingDays) {
        if (entradaDates.has(d)) physicalPastDays++;
        else if (vacationDaysSet.has(d) || justifiedDates.has(d)) {
          // dia pago (férias ou falta justificada) — sem subsídio de alimentação
        } else unpaidAbsenceDays++;
      }

      // Dias de férias no período futuro assumido (não recebem alimentação).
      futureVacationDays = futureWorkingDaysList.filter((d) =>
        vacationDaysSet.has(d)
      ).length;
    }

    // Vencimento base: pago por todos os dias exceto faltas não pagas (as
    // férias e os dias futuros assumidos contam como pagos). No tempo parcial, o
    // vencimento é calculado por meio período trabalhado (ver baseOverride).
    const daysWorked = isPartTime
      ? partTimeDaysWorked
      : Math.max(0, workingDays - unpaidAbsenceDays);
    // Subsídio de alimentação: apenas dias de presença física passados + dias
    // úteis futuros assumidos que não sejam férias. No tempo parcial, só os dias
    // efetivamente marcados (sem assumir dias futuros).
    const mealDays = isPartTime
      ? partTimeDaysWorked
      : Math.max(
          0,
          physicalPastDays + (futureWorkingDaysList.length - futureVacationDays)
        );
    // Tempo parcial: vencimento = nº de meios períodos × valor por período.
    const baseOverride = isPartTime
      ? partTimePeriods * (profile.periodRate || 0)
      : undefined;

    // Prémio de assiduidade e pontualidade: recolhe os atrasos > 5 min do mês.
    let premioAssiduidade = 0;
    let premioQualificado = false;
    if (profile.userId) {
      const latePunches = await prisma.timeRecord.findMany({
        where: {
          userId: profile.userId,
          workDate: { startsWith: `${month}-` },
          lateMinutes: { gt: 5 },
        },
        select: { lateMinutes: true, delayReason: true },
      });
      const delays: DelayInfo[] = latePunches.map((r) => ({
        lateMinutes: r.lateMinutes ?? 0,
        justified: !!(r.delayReason && r.delayReason.trim().length > 0),
      }));
      const taskMisses = await prisma.dailyTaskMiss.count({
        where: { userId: profile.userId, missDate: { startsWith: `${month}-` } },
      });
      // Faltas injustificadas para efeitos de prémio: no tempo inteiro contam
      // todos os dias úteis JÁ PASSADOS (anteriores a hoje) sem marcação de
      // entrada, que não sejam férias nem falta justificada — ou seja, os dias
      // em branco também contam. No tempo parcial mantém-se apenas as faltas
      // INJUSTIFICADAS registadas. Usa o mesmo helper do controlo/assiduidade
      // para garantir que as faltas mostradas coincidem com as do prémio.
      const injustForBonus = await countBonusInjustifiedDays(
        profile.userId,
        month,
        isPartTime
      );
      const bonus = computeAttendanceBonus({
        month,
        absInjustDays: injustForBonus,
        delays,
        taskMisses,
      });
      premioAssiduidade = bonus.amount;
      premioQualificado = bonus.qualified;
    }

    const input: SalaryProfileInput = {
      vencimentoBase: profile.vencimentoBase,
      mealPerDay: profile.mealPerDay,
      subsFerias: profile.subsFerias,
      subsNatal: profile.subsNatal,
      ssRate: profile.ssRate,
      irsRate: profile.irsRate,
    };
    const c = computePayslip(input, {
      workingDays,
      daysWorked,
      mealDays,
      premioAssiduidade,
      baseOverride,
    });

    const data: any = {
      month,
      name: profile.name,
      employeeNumber: profile.employeeNumber,
      category: profile.category,
      userId: profile.userId,
      salarioBase: profile.vencimentoBase,
      vencimentoBase: c.vencimentoBase,
      subsAlimentacao: c.subsAlimentacao,
      subsFerias: c.subsFerias,
      subsNatal: c.subsNatal,
      premioAssiduidade: c.premioAssiduidade,
      premioQualificado,
      outrosAbonos: 0,
      totalFaltas: c.totalFaltas,
      segSocial: c.segSocial,
      irs: c.irs,
      outrosDescontos: 0,
      totalIliquido: c.totalIliquido,
      totalDescontos: c.totalDescontos,
      liquido: c.liquido,
      workingDays,
      daysWorked,
      absJustDays,
      absInjustDays,
      feriasDays,
      autoGenerated: true,
    };

    await prisma.payslip.upsert({
      where: { month_name: { month, name: profile.name } },
      update: data,
      create: data,
    });

    rows.push({
      name: profile.name,
      workingDays,
      daysWorked,
      absJustDays,
      absInjustDays,
      totalIliquido: c.totalIliquido,
      totalDescontos: c.totalDescontos,
      liquido: c.liquido,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return { month, rows };
}

// Regenera automaticamente o recibo de um colaborador para um mês, MAS apenas
// se já existir um recibo para esse mês. Usado quando o administrador corrige a
// assiduidade (marcações ou faltas): o valor do recibo é recalculado de imediato
// para refletir a correção. Nunca cria recibos novos por si só e nunca falha o
// pedido de correção — é sempre "best-effort".
export async function regeneratePayslipIfExists(
  userId: string,
  month: string
): Promise<boolean> {
  try {
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return false;
    const profile = await prisma.salaryProfile.findUnique({
      where: { userId },
      select: { name: true },
    });
    if (!profile) return false;
    const existing = await prisma.payslip.findUnique({
      where: { month_name: { month, name: profile.name } },
      select: { id: true },
    });
    if (!existing) return false;
    await generatePayslipsForMonth(month, { userId });
    return true;
  } catch (e) {
    console.error("Erro ao regenerar recibo após correção de assiduidade:", e);
    return false;
  }
}
