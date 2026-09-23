// Prémio de assiduidade e pontualidade.
//
// Regras (verificadas pelos registos de ponto da empresa):
//  - Valor: 40,00 € por mês, pago com o vencimento do mês (sujeito a IRS e
//    Segurança Social). Aparece como linha discriminada no recibo. Não integra
//    a retribuição nem conta para subsídios de férias/Natal.
//  - Assiduidade: é permitida até 1 falta injustificada no mês. A 2.ª falta
//    injustificada faz perder o prémio nesse mês.
//  - Pontualidade: um atraso conta quando a marcação é feita mais de 5 minutos
//    depois da hora prevista. São permitidos até 3 atrasos injustificados no
//    mês. O 4.º atraso injustificado OU um único atraso superior a 30 minutos
//    sem justificação faz perder o prémio nesse mês.
//  - As faltas justificadas (previstas na lei) não retiram o direito ao prémio.
//  - Em vigor a partir de 01/07/2026.

export const BONUS_VALUE = 40;
// Primeiro mês (AAAA-MM) em que o prémio pode ser atribuído.
export const BONUS_EFFECTIVE_MONTH = "2026-07";
export const BONUS_MAX_UNJUSTIFIED_DELAYS = 3;
// Faltas injustificadas permitidas por mês sem perder o prémio.
export const BONUS_MAX_UNJUSTIFIED_ABSENCES = 1;
// Dias sem as tarefas diárias cumpridas permitidos por mês. Ao ULTRAPASSAR
// este número (ou seja, a partir do 5.º dia), o colaborador perde o prémio.
export const BONUS_MAX_TASK_MISSES = 4;
export const BONUS_MAX_DELAY_MINUTES = 30;
export const BONUS_DELAY_TOLERANCE_MINUTES = 5;

export type DelayInfo = {
  // Minutos de atraso da marcação (lateMinutes).
  lateMinutes: number;
  // Se o colaborador justificou este atraso (delayReason preenchido).
  justified: boolean;
};

export type BonusResult = {
  // Se o mês já está abrangido pelo prémio (>= mês de entrada em vigor).
  effective: boolean;
  qualified: boolean;
  amount: number;
  absInjustDays: number;
  unjustifiedDelays: number;
  maxUnjustifiedDelayMinutes: number;
  // Dias do mês em que as tarefas diárias não foram cumpridas.
  taskMisses: number;
  // Motivos pelos quais o prémio não foi atribuído (vazio se qualificado).
  reasons: string[];
};

// Determina se um mês "AAAA-MM" já está abrangido pelo prémio.
export function isBonusEffective(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month) && month >= BONUS_EFFECTIVE_MONTH;
}

// Calcula a qualificação e o valor do prémio para um mês.
export function computeAttendanceBonus(opts: {
  month: string;
  absInjustDays: number;
  // Todas as marcações com atraso > 5 min no mês.
  delays: DelayInfo[];
  // Dias do mês marcados pelo administrador como "tarefas diárias não feitas".
  taskMisses?: number;
}): BonusResult {
  const effective = isBonusEffective(opts.month);
  const absInjustDays = Math.max(0, opts.absInjustDays ?? 0);
  const taskMisses = Math.max(0, opts.taskMisses ?? 0);

  // Só contam os atrasos injustificados acima da tolerância.
  const unjustified = (opts.delays ?? []).filter(
    (d) => !d.justified && (d.lateMinutes ?? 0) > BONUS_DELAY_TOLERANCE_MINUTES
  );
  const unjustifiedDelays = unjustified.length;
  const maxUnjustifiedDelayMinutes = unjustified.reduce(
    (m, d) => Math.max(m, d.lateMinutes ?? 0),
    0
  );

  const reasons: string[] = [];
  if (absInjustDays > BONUS_MAX_UNJUSTIFIED_ABSENCES) {
    reasons.push(
      `${absInjustDays} faltas injustificadas no mês (máximo permitido: ${BONUS_MAX_UNJUSTIFIED_ABSENCES}).`
    );
  }
  if (unjustifiedDelays > BONUS_MAX_UNJUSTIFIED_DELAYS) {
    reasons.push(
      `${unjustifiedDelays} atrasos injustificados (máximo permitido: ${BONUS_MAX_UNJUSTIFIED_DELAYS}).`
    );
  }
  if (maxUnjustifiedDelayMinutes > BONUS_MAX_DELAY_MINUTES) {
    reasons.push(
      `Atraso injustificado superior a ${BONUS_MAX_DELAY_MINUTES} minutos.`
    );
  }
  if (taskMisses > BONUS_MAX_TASK_MISSES) {
    reasons.push(
      `${taskMisses} dias sem as tarefas diárias cumpridas (máximo permitido: ${BONUS_MAX_TASK_MISSES}).`
    );
  }

  const qualified = effective && reasons.length === 0;
  const amount = qualified ? BONUS_VALUE : 0;

  return {
    effective,
    qualified,
    amount,
    absInjustDays,
    unjustifiedDelays,
    maxUnjustifiedDelayMinutes,
    taskMisses,
    reasons,
  };
}
