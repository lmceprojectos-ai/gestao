// Email às duas empresas sempre que um registo é criado, editado ou eliminado
// (pode ser desligado em cada ação). Enviado pelo email da Gestão (SMTP).
import type { Totals } from '@/lib/parceiros/calc';
import { formatSigned } from '@/lib/parceiros/format';
import { sendMail } from '@/lib/email';

const RECIPIENTS = ['luismiguel@kh4.pt', 'comercial@reclamarte.pt'];

interface NotifyParams {
  action: 'criado' | 'editado' | 'eliminado';
  actor: string;
  summary: { date: string; description: string; reference: string | null; typeLabel: string; amount: number; isBilled: boolean };
  totals: Totals;
}

const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function perspective(v: number): string {
  if (v > 0) return `Reclamarte deve ${formatSigned(v)}`;
  if (v < 0) return `Criaconsensos deve ${formatSigned(Math.abs(v))}`;
  return 'Saldo liquidado (0,00 €)';
}

export async function notifyChange(params: NotifyParams): Promise<void> {
  const s = params.summary;
  const t = params.totals;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color:#1f2937;">
      <div style="background:#1e3a5f; color:#fff; padding:18px 24px; border-radius:8px 8px 0 0;">
        <h2 style="margin:0; font-size:18px;">Conta Corrente · Criaconsensos</h2>
        <p style="margin:4px 0 0; font-size:13px; opacity:.85;">Notificação de alteração</p>
      </div>
      <div style="background:#f9fafb; padding:24px; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;">Foi <strong>${params.action}</strong> um registo na conta corrente por <strong>${esc(params.actor)}</strong>.</p>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:20px;">
          <tr><td style="padding:6px 0; color:#6b7280;">Data</td><td style="padding:6px 0; text-align:right; font-weight:600;">${esc(s.date)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Descrição</td><td style="padding:6px 0; text-align:right; font-weight:600;">${esc(s.description)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Referência</td><td style="padding:6px 0; text-align:right;">${esc(s.reference) || '—'}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Tipo</td><td style="padding:6px 0; text-align:right;">${esc(s.typeLabel)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Valor</td><td style="padding:6px 0; text-align:right; font-weight:600;">${formatSigned(s.amount)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Estado</td><td style="padding:6px 0; text-align:right;">${s.isBilled ? 'Faturado' : 'Não Faturado'}</td></tr>
        </table>
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:16px;">
          <h3 style="margin:0 0 12px; font-size:15px; color:#1e3a5f;">Saldos atualizados</h3>
          <p style="margin:6px 0; font-size:14px;"><strong>Faturado:</strong> ${perspective(t.billed)}</p>
          <p style="margin:6px 0; font-size:14px;"><strong>Não Faturado:</strong> ${perspective(t.unbilled)}</p>
          <p style="margin:6px 0; font-size:14px; padding-top:8px; border-top:1px solid #e5e7eb;"><strong>Total:</strong> ${perspective(t.total)}</p>
        </div>
        <p style="color:#9ca3af; font-size:12px; margin-top:20px;">Perspetiva: valores positivos significam que a Reclamarte deve à Criaconsensos.</p>
      </div>
    </div>`;
  await Promise.all(
    RECIPIENTS.map(async (to) => {
      const r = await sendMail({ to, subject: `Conta Corrente — registo ${params.action}`, html, fromName: 'Conta Corrente Criaconsensos' });
      if (!r.ok) console.error('Parceiros: email não enviado para', to, r.error);
    }),
  );
}
