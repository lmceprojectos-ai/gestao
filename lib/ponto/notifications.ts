// Helper para envio de notificações por email (lado servidor)
import { sendMail } from "@/lib/email";

export const ADMIN_EMAIL = "luismiguel@kh4.pt";
export const SMS_NUMBER = "912256186";

type SendArgs = {
  notificationId: string | undefined;
  subject: string;
  body: string;
  recipientEmail: string;
};

export async function sendEmail({
  notificationId,
  subject,
  body,
  recipientEmail,
}: SendArgs): Promise<boolean> {
  void notificationId; // herdado da Abacus; o envio é agora por SMTP
  try {
    const { ok } = await sendMail({
      to: recipientEmail,
      subject,
      html: body,
      fromName: "Criaconsensos · Livro de Ponto",
    });
    if (ok) console.log(`Email enviado para ${recipientEmail} (${subject})`);
    return ok;
  } catch (e) {
    console.error("Falha ao enviar email de notificação:", e);
    return false;
  }
}

export function emailTemplate(title: string, rows: [string, string][], note?: string): string {
  const body = rows
    .map(
      ([k, v]) =>
        `<p style="margin:8px 0;"><strong style="color:#1f2937;">${k}:</strong> ${v}</p>`
    )
    .join("");
  return `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
      <h2 style="color:#1f2937; border-bottom:3px solid #feca00; padding-bottom:10px;">${title}</h2>
      <div style="background:#f8fafc; padding:20px; border-radius:8px; margin:16px 0;">${body}</div>
      ${note ? `<p style="color:#64748b; font-size:13px;">${note}</p>` : ""}
      <p style="color:#94a3b8; font-size:12px; margin-top:20px;">Criaconsensos Unipessoal Lda · Livro de Ponto</p>
    </div>`;
}
