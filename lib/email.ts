// Envio de emails pelo servidor SMTP próprio.
import nodemailer from 'nodemailer';

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
}

export async function sendMail({
  to,
  subject,
  html,
  fromName = 'CRIACONSENSOS',
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.error('SMTP não configurado (SMTP_HOST/SMTP_USER em falta) — email não enviado:', subject);
    return { ok: false, error: 'Servidor de email não configurado' };
  }
  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      replyTo,
    });
    return { ok: true };
  } catch (err: any) {
    console.error('Erro ao enviar email:', err?.message);
    return { ok: false, error: err?.message || 'Erro ao enviar email' };
  }
}
