import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplate } from "@/lib/ponto/notifications";

export const dynamic = "force-dynamic";

// Solicita a alteração da palavra-passe. Pode ser chamado:
// - autenticado (utiliza o email da sessão);
// - não autenticado, enviando { email } ("esqueci-me da palavra-passe").
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let email = "";
    if (session?.user?.email) {
      email = session.user.email.toLowerCase().trim();
    } else {
      const body = await request.json().catch(() => ({}));
      email = (body?.email ?? "").toLowerCase().trim();
    }

    // Resposta genérica para não revelar se o email existe.
    const genericOk = NextResponse.json({
      success: true,
      message:
        "Se existir uma conta com este email, será enviado um link para alterar a palavra-passe.",
    });

    if (!email) {
      return NextResponse.json(
        { message: "Indique o email da conta." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return genericOk;
    }

    // Invalida tokens anteriores ainda válidos deste utilizador.
    await prisma.pontoPasswordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await prisma.pontoPasswordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const appUrl = process.env.NEXTAUTH_URL || "https://app.abacusai.app";
    const link = `${appUrl}/ponto/redefinir-senha?token=${token}`;

    const html = emailTemplate(
      "Alteração de palavra-passe",
      [
        ["Conta", user.name ?? ""],
        ["Email", user.email],
      ],
      `Para definir uma nova palavra-passe, clique no botão abaixo. O link é válido durante 1 hora e só pode ser utilizado uma vez.<br/><br/>
       <a href="${link}" style="display:inline-block;background:#feca00;color:#1f2937;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Alterar palavra-passe</a><br/><br/>
       Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
       <span style="color:#64748b;word-break:break-all;">${link}</span><br/><br/>
       Se não foi você a pedir esta alteração, ignore este email — a sua palavra-passe permanece inalterada.`
    );

    await sendEmail({
      notificationId: process.env.NOTIF_ID_ALTERAO_DE_PALAVRAPASSE,
      subject: "Alteração de palavra-passe · Livro de Ponto",
      body: html,
      recipientEmail: user.email,
    });

    return genericOk;
  } catch (e) {
    console.error("Erro ao solicitar alteração de palavra-passe:", e);
    return NextResponse.json(
      { message: "Erro ao processar o pedido." },
      { status: 500 }
    );
  }
}
