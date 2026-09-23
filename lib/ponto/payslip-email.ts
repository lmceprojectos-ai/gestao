// Construção e envio dos emails de recibos (resumo mensal + contabilidade).
// Partilhado pela tarefa automática do dia 25 (cron) e pelo painel de
// administração, para que o email pré-visualizado seja exatamente igual ao
// email realmente enviado.

import { prisma } from "@/lib/db";
import { eur, monthLabel } from "@/lib/ponto/payslip";
import { sendEmail } from "@/lib/ponto/notifications";
import { generatePayslipsForMonth } from "@/lib/ponto/payslip-generate";
import { signPayslipToken } from "@/lib/ponto/payslip-pdf";

// Destinatário do resumo mensal.
export const SUMMARY_RECIPIENT = "luismiguel@kh4.pt";
// Destinatários do envio à contabilidade (inclui luismiguel@kh4.pt).
export const ACCOUNTING_RECIPIENTS = [
  "carla@jaconsult.pt",
  "jorge@jaconsult.pt",
  "luismiguel@kh4.pt",
];

export const SEND_LOG_PREFIX = "payslip_send_log:";

// Botão de download do registo de assiduidade mensal em PDF (dias trabalhados,
// entradas/saídas e horas de almoço). Para a contabilidade validar os pontos.
function assiduidadeButton(p: PayslipRow): string {
  if (!p.id) return "";
  const base = process.env.NEXTAUTH_URL || "";
  const url = `${base}/api/ponto/assiduidade/${p.id}?token=${signPayslipToken(p.id)}`;
  return `<a href="${url}" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;font-weight:600;font-size:12px;padding:6px 12px;border-radius:6px;">Assiduidade</a>`;
}

type PayslipRow = {
  id?: string | null;
  month?: string | null;
  name: string;
  category?: string | null;
  vencimentoBase?: number | null;
  subsAlimentacao?: number | null;
  subsFerias?: number | null;
  subsNatal?: number | null;
  totalIliquido?: number | null;
  segSocial?: number | null;
  irs?: number | null;
  totalDescontos?: number | null;
  liquido?: number | null;
  premioAssiduidade?: number | null;
  premioQualificado?: boolean | null;
  userId?: string | null;
};

export type SendLog = {
  month: string;
  sentAt: string; // ISO
  summaryRecipient: string;
  summaryEmailed: boolean;
  accountingRecipients: string[];
  accountingCount: number;
  accountingEmailed: boolean;
  count: number;
  trigger: "auto" | "manual";
};

// ── Construção dos emails ────────────────────────────────────────────────

export function buildSummaryEmail(
  month: string,
  payslips: PayslipRow[]
): { subject: string; body: string } {
  const totals = payslips.reduce(
    (acc, p) => {
      acc.iliquido += p.totalIliquido || 0;
      acc.descontos += p.totalDescontos || 0;
      acc.liquido += p.liquido || 0;
      acc.premio += p.premioQualificado ? p.premioAssiduidade || 0 : 0;
      return acc;
    },
    { iliquido: 0, descontos: 0, liquido: 0, premio: 0 }
  );

  const rowsHtml = payslips
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${p.name}${
        p.category ? `<br><span style="color:#64748b;font-size:12px;">${p.category}</span>` : ""
      }</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;${
          p.premioQualificado && (p.premioAssiduidade || 0) > 0 ? "color:#15803d;font-weight:600;" : "color:#94a3b8;"
        }">${p.premioQualificado && (p.premioAssiduidade || 0) > 0 ? eur(p.premioAssiduidade || 0) : "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(
          p.totalIliquido || 0
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b91c1c;">${eur(
          p.totalDescontos || 0
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${eur(
          p.liquido || 0
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap;">${assiduidadeButton(
          p
        )}</td>
      </tr>`
    )
    .join("");

  const body = `
    <div style="font-family: Arial, sans-serif; max-width:760px; margin:0 auto;">
      <h2 style="color:#1f2937; border-bottom:3px solid #feca00; padding-bottom:10px;">Resumo Mensal de Recibos</h2>
      <p style="color:#334155;">Fecho referente a <strong>${monthLabel(
        month
      )}</strong>. Total de ${payslips.length} recibo(s).</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
        <thead>
          <tr style="background:#feca00; color:#1f2937;">
            <th style="padding:10px;text-align:left;">Colaborador</th>
            <th style="padding:10px;text-align:right;">Prémio Assid.</th>
            <th style="padding:10px;text-align:right;">Total Ilíquido</th>
            <th style="padding:10px;text-align:right;">Descontos</th>
            <th style="padding:10px;text-align:right;">Líquido</th>
            <th style="padding:10px;text-align:center;">Assiduidade</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9; font-weight:700;">
            <td style="padding:10px;">TOTAL</td>
            <td style="padding:10px;text-align:right;color:#15803d;">${eur(totals.premio)}</td>
            <td style="padding:10px;text-align:right;">${eur(totals.iliquido)}</td>
            <td style="padding:10px;text-align:right;color:#b91c1c;">${eur(totals.descontos)}</td>
            <td style="padding:10px;text-align:right;">${eur(totals.liquido)}</td>
            <td style="padding:10px;"></td>
          </tr>
        </tfoot>
      </table>
      <p style="color:#94a3b8; font-size:12px; margin-top:20px;">Criaconsensos Unipessoal Lda · Livro de Ponto</p>
    </div>`;

  return { subject: `Resumo de Recibos — ${monthLabel(month)}`, body };
}

export function buildAccountingEmail(
  month: string,
  eligiblePayslips: PayslipRow[]
): { subject: string; body: string } {
  const accTotals = eligiblePayslips.reduce(
    (acc, p) => {
      acc.iliquido += p.totalIliquido || 0;
      acc.descontos += p.totalDescontos || 0;
      acc.liquido += p.liquido || 0;
      acc.premio += p.premioQualificado ? p.premioAssiduidade || 0 : 0;
      acc.duodecimos += (p.subsFerias || 0) + (p.subsNatal || 0);
      return acc;
    },
    { iliquido: 0, descontos: 0, liquido: 0, premio: 0, duodecimos: 0 }
  );
  const accRows = eligiblePayslips
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${p.name}${
        p.category ? `<br><span style=\"color:#64748b;font-size:12px;\">${p.category}</span>` : ""
      }</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(p.vencimentoBase || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(p.subsAlimentacao || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;${
          p.premioQualificado && (p.premioAssiduidade || 0) > 0 ? "color:#15803d;font-weight:600;" : "color:#94a3b8;"
        }">${p.premioQualificado && (p.premioAssiduidade || 0) > 0 ? eur(p.premioAssiduidade || 0) : "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${((p.subsFerias || 0) + (p.subsNatal || 0)) > 0 ? eur((p.subsFerias || 0) + (p.subsNatal || 0)) : "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(p.totalIliquido || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(p.segSocial || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${eur(p.irs || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b91c1c;">${eur(p.totalDescontos || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${eur(p.liquido || 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap;">${assiduidadeButton(p)}</td>
      </tr>`
    )
    .join("");
  const ml = monthLabel(month);
  const mlLower = ml.charAt(0).toLowerCase() + ml.slice(1);
  const nColab = eligiblePayslips.length;
  const colabLabel = nColab === 1 ? "colaborador" : "colaboradores";
  const body = `
    <div style="font-family: Arial, sans-serif; max-width:840px; margin:0 auto;">
      <h2 style="color:#1f2937; border-bottom:3px solid #feca00; padding-bottom:10px;">Registo de ponto para a contabilidade</h2>
      <p style="color:#334155;">Registo de ponto referente a <strong>${mlLower}</strong>, da Criaconsensos Unipessoal Lda validados para o envio de ${nColab} ${colabLabel}.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
        <thead>
          <tr style="background:#feca00; color:#1f2937;">
            <th style="padding:10px;text-align:left;">Colaborador</th>
            <th style="padding:10px;text-align:right;">Venc. Base</th>
            <th style="padding:10px;text-align:right;">Subs. Alim.</th>
            <th style="padding:10px;text-align:right;">Prémio Assid.</th>
            <th style="padding:10px;text-align:right;">Duodécimos</th>
            <th style="padding:10px;text-align:right;">Ilíquido</th>
            <th style="padding:10px;text-align:right;">Seg. Social</th>
            <th style="padding:10px;text-align:right;">IRS</th>
            <th style="padding:10px;text-align:right;">Descontos</th>
            <th style="padding:10px;text-align:right;">Líquido</th>
            <th style="padding:10px;text-align:center;">Assiduidade</th>
          </tr>
        </thead>
        <tbody>${accRows}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9; font-weight:700;">
            <td style="padding:10px;" colspan="3">TOTAL</td>
            <td style="padding:10px;text-align:right;color:#15803d;">${eur(accTotals.premio)}</td>
            <td style="padding:10px;text-align:right;">${eur(accTotals.duodecimos)}</td>
            <td style="padding:10px;text-align:right;">${eur(accTotals.iliquido)}</td>
            <td style="padding:10px;text-align:right;" colspan="2"></td>
            <td style="padding:10px;text-align:right;color:#b91c1c;">${eur(accTotals.descontos)}</td>
            <td style="padding:10px;text-align:right;">${eur(accTotals.liquido)}</td>
            <td style="padding:10px;"></td>
          </tr>
        </tfoot>
      </table>
      <p style="color:#94a3b8; font-size:12px; margin-top:20px;">Criaconsensos Unipessoal Lda · Livro de Ponto</p>
    </div>`;
  return {
    subject: `Registo de ponto — ${monthLabel(month)} — Criaconsensos Unipessoal Lda`,
    body,
  };
}

// ── Leitura dos dados ────────────────────────────────────────────────────

export async function getMonthPayslips(month: string): Promise<PayslipRow[]> {
  return prisma.payslip.findMany({
    where: { month },
    orderBy: { name: "asc" },
  }) as unknown as Promise<PayslipRow[]>;
}

export async function getEligiblePayslips(
  month: string,
  payslips?: PayslipRow[]
): Promise<PayslipRow[]> {
  const all = payslips ?? (await getMonthPayslips(month));
  // Identifica os colaboradores do ponto pelo perfil dedicado (pontoRole),
  // para incluir também quem tem, na mesma conta, um perfil de Gestão
  // diferente (ex.: um colaborador que também é administrador da Gestão, cujo
  // role passa a "admin"). Mantém a compatibilidade com contas antigas em que
  // o pontoRole ainda não está definido (usa então o role).
  const eligibleUsers = await prisma.user.findMany({
    where: {
      sendToAccounting: true,
      OR: [
        { pontoRole: "COLABORADOR" },
        { pontoRole: null, role: "COLABORADOR" },
      ],
    },
    select: { id: true },
  });
  const eligibleIds = new Set(eligibleUsers.map((u) => u.id));
  return all.filter((p) => p.userId && eligibleIds.has(p.userId));
}

// ── Registo de envios (tabela Setting) ───────────────────────────────────

export async function getSendLog(month: string): Promise<SendLog | null> {
  const row = await prisma.setting.findUnique({
    where: { key: `${SEND_LOG_PREFIX}${month}` },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SendLog;
  } catch {
    return null;
  }
}

export async function getAllSendLogs(): Promise<Record<string, SendLog>> {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: SEND_LOG_PREFIX } },
  });
  const out: Record<string, SendLog> = {};
  for (const r of rows) {
    try {
      const log = JSON.parse(r.value) as SendLog;
      out[log.month] = log;
    } catch {
      /* ignora entradas inválidas */
    }
  }
  return out;
}

async function saveSendLog(log: SendLog): Promise<void> {
  const key = `${SEND_LOG_PREFIX}${log.month}`;
  const value = JSON.stringify(log);
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// ── Envio completo de um mês ─────────────────────────────────────────────

export type SendResult = {
  success: boolean;
  month: string;
  count: number;
  emailed: boolean;
  accountingCount: number;
  accountingEmailed: boolean;
  message?: string;
  log?: SendLog;
};

export async function sendPayslipEmailsForMonth(
  month: string,
  opts: { generate?: boolean; trigger?: "auto" | "manual" } = {}
): Promise<SendResult> {
  const { generate = true, trigger = "auto" } = opts;

  if (generate) {
    try {
      await generatePayslipsForMonth(month);
    } catch (e) {
      console.error("Erro ao gerar recibos antes do envio:", e);
    }
  }

  const payslips = await getMonthPayslips(month);
  if (payslips.length === 0) {
    return {
      success: true,
      month,
      count: 0,
      emailed: false,
      accountingCount: 0,
      accountingEmailed: false,
      message: "Sem perfis/recibos para o mês; email não enviado.",
    };
  }

  // O resumo mensal foi descontinuado a pedido: apenas se envia o registo de
  // ponto para a contabilidade.
  const emailed = false;

  const eligiblePayslips = await getEligiblePayslips(month, payslips);
  let accountingEmailed = false;
  if (eligiblePayslips.length > 0) {
    const acc = buildAccountingEmail(month, eligiblePayslips);
    const results = await Promise.all(
      ACCOUNTING_RECIPIENTS.map((to) =>
        sendEmail({
          notificationId: process.env.NOTIF_ID_RECIBOS_PARA_A_CONTABILIDADE,
          subject: acc.subject,
          body: acc.body,
          recipientEmail: to,
        })
      )
    );
    accountingEmailed = results.some(Boolean);
  }

  const log: SendLog = {
    month,
    sentAt: new Date().toISOString(),
    summaryRecipient: SUMMARY_RECIPIENT,
    summaryEmailed: emailed,
    accountingRecipients: ACCOUNTING_RECIPIENTS,
    accountingCount: eligiblePayslips.length,
    accountingEmailed,
    count: payslips.length,
    trigger,
  };
  try {
    await saveSendLog(log);
  } catch (e) {
    console.error("Erro ao registar envio de recibos:", e);
  }

  return {
    success: true,
    month,
    count: payslips.length,
    emailed,
    accountingCount: eligiblePayslips.length,
    accountingEmailed,
    log,
  };
}

// Envia à contabilidade o recibo de UM único colaborador (envio manual a
// partir do separador Colaboradores). Gera primeiro o recibo do colaborador
// para garantir que os valores estão atualizados. Não altera o registo de
// envios mensal (esse é do envio do dia 25).
export async function sendSingleAccountingEmail(
  month: string,
  userId: string
): Promise<{ success: boolean; emailed: boolean; message?: string }> {
  try {
    await generatePayslipsForMonth(month, { userId });
  } catch (e) {
    console.error("Erro ao gerar recibo antes do envio individual:", e);
  }

  const payslip = await prisma.payslip.findFirst({ where: { month, userId } });
  if (!payslip) {
    return {
      success: false,
      emailed: false,
      message:
        "Sem recibo para este colaborador neste mês. Gere primeiro o recibo.",
    };
  }

  const acc = buildAccountingEmail(month, [payslip as unknown as PayslipRow]);
  const results = await Promise.all(
    ACCOUNTING_RECIPIENTS.map((to) =>
      sendEmail({
        notificationId: process.env.NOTIF_ID_RECIBOS_PARA_A_CONTABILIDADE,
        subject: acc.subject,
        body: acc.body,
        recipientEmail: to,
      })
    )
  );
  return { success: true, emailed: results.some(Boolean) };
}
