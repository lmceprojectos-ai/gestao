export const dynamic = 'force-dynamic';

import { sendMail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = (body?.email ?? '').trim().toLowerCase();

    // Always respond with success to avoid revealing which emails exist.
    const genericResponse = NextResponse.json({
      message:
        'Se existir uma conta associada a este email, receberá uma mensagem com instruções para repor a palavra-passe.',
    });

    if (!email) {
      return genericResponse;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return genericResponse;
    }

    // Generate a secure random token; store only its hash.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any previous unused tokens for this email.
    await prisma.passwordResetToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { email, tokenHash, expiresAt },
    });

    const appUrl = process.env.NEXTAUTH_URL || '';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg,#1e3a5f,#0d9488); padding: 24px; border-radius: 12px 12px 0 0; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:20px; letter-spacing:0.5px;">CRIACONSENSOS</h1>
          <p style="color:rgba(255,255,255,0.8); margin:4px 0 0; font-size:13px;">Gestão Financeira</p>
        </div>
        <div style="background:#ffffff; padding:28px; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 12px 12px;">
          <h2 style="font-size:18px; margin-top:0;">Reposição de palavra-passe</h2>
          <p style="font-size:14px; line-height:1.6;">Olá${user.name ? ' ' + user.name : ''},</p>
          <p style="font-size:14px; line-height:1.6;">Recebemos um pedido para repor a palavra-passe da sua conta. Clique no botão abaixo para definir uma nova palavra-passe. Esta ligação é válida durante <strong>1 hora</strong>.</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${resetUrl}" style="background:#0d9488; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">Definir nova palavra-passe</a>
          </div>
          <p style="font-size:12px; line-height:1.6; color:#6b7280;">Se o botão não funcionar, copie e cole este endereço no seu navegador:<br><span style="color:#0d9488; word-break:break-all;">${resetUrl}</span></p>
          <p style="font-size:12px; line-height:1.6; color:#6b7280; margin-top:24px;">Se não foi você a pedir esta reposição, pode ignorar esta mensagem — a sua palavra-passe permanecerá inalterada.</p>
        </div>
      </div>
    `;

    try {
      const result = await sendMail({
        to: email,
        subject: 'Reposição de palavra-passe — CRIACONSENSOS',
        html: htmlBody,
      });
      if (!result.ok) {
        console.error('Falha ao enviar email de reposição:', result.error);
      }
    } catch (mailErr) {
      console.error('Erro ao enviar email de reposição:', mailErr);
    }

    return genericResponse;
  } catch (error: any) {
    console.error('Erro em forgot-password:', error);
    return NextResponse.json(
      { message: 'Se existir uma conta associada a este email, receberá uma mensagem com instruções.' },
    );
  }
}
