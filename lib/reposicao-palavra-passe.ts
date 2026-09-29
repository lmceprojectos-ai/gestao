// Email com o link para definir/repor a palavra-passe (página /reset-password).
// Usado no "Esqueci-me da palavra-passe" e no primeiro acesso dos parceiros.
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/email';

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function enviarEmailPalavraPasse({
  email, nome, primeiroAcesso = false, empresa,
}: { email: string; nome?: string | null; primeiroAcesso?: boolean; empresa?: string }) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const horas = primeiroAcesso ? 24 : 1;
  // Só fica guardado o hash; os pedidos anteriores deixam de valer.
  await prisma.passwordResetToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { email, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + horas * 3600 * 1000) } });

  const resetUrl = `${process.env.NEXTAUTH_URL || ''}/reset-password?token=${rawToken}`;
  const titulo = primeiroAcesso ? 'Definir a sua palavra-passe' : 'Reposição de palavra-passe';
  const texto = primeiroAcesso
    ? `Foi criado o seu acesso à conta corrente${empresa ? ` entre a <strong>${empresa}</strong> e a Criaconsensos` : ''}. Clique no botão abaixo para escolher a sua palavra-passe. Esta ligação é válida durante <strong>24 horas</strong>.`
    : 'Recebemos um pedido para repor a palavra-passe da sua conta. Clique no botão abaixo para definir uma nova palavra-passe. Esta ligação é válida durante <strong>1 hora</strong>.';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background: linear-gradient(135deg,#1e3a5f,#0d9488); padding: 24px; border-radius: 12px 12px 0 0; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:20px; letter-spacing:0.5px;">CRIACONSENSOS</h1>
        <p style="color:rgba(255,255,255,0.8); margin:4px 0 0; font-size:13px;">${primeiroAcesso ? 'Conta corrente' : 'Gestão Financeira'}</p>
      </div>
      <div style="background:#ffffff; padding:28px; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 12px 12px;">
        <h2 style="font-size:18px; margin-top:0;">${titulo}</h2>
        <p style="font-size:14px; line-height:1.6;">Olá${nome ? ' ' + nome : ''},</p>
        <p style="font-size:14px; line-height:1.6;">${texto}</p>
        <div style="text-align:center; margin:28px 0;">
          <a href="${resetUrl}" style="background:#0d9488; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">${primeiroAcesso ? 'Definir palavra-passe' : 'Definir nova palavra-passe'}</a>
        </div>
        <p style="font-size:12px; line-height:1.6; color:#6b7280;">Se o botão não funcionar, copie e cole este endereço no seu navegador:<br><span style="color:#0d9488; word-break:break-all;">${resetUrl}</span></p>
        <p style="font-size:12px; line-height:1.6; color:#6b7280; margin-top:24px;">Se não foi você a pedir, pode ignorar esta mensagem.</p>
      </div>
    </div>`;
  const r = await sendMail({ to: email, subject: `${titulo} — CRIACONSENSOS`, html });
  if (!r.ok) console.error('Falha ao enviar email de palavra-passe:', r.error);
  return r.ok;
}
