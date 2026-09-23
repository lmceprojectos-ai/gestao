import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";

export const dynamic = "force-dynamic";

// Gera um link de reposição de palavra-passe para um colaborador.
// Solução independente do email: o administrador copia o link e entrega-o
// diretamente ao colaborador (por exemplo, por mensagem ou pessoalmente).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json(
        { message: "Colaborador não encontrado." },
        { status: 404 }
      );
    }

    // Invalida tokens anteriores ainda válidos deste utilizador.
    await prisma.pontoPasswordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await prisma.pontoPasswordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const appUrl = process.env.NEXTAUTH_URL || "https://app.abacusai.app";
    const link = `${appUrl}/ponto/redefinir-senha?token=${token}`;

    return NextResponse.json({
      success: true,
      link,
      expiresAt,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (e) {
    console.error("Erro ao gerar link de reposição:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
