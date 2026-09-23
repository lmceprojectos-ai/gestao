import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function findValidToken(token: string) {
  if (!token) return null;
  const record = await prisma.pontoPasswordResetToken.findUnique({
    where: { token },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

// Valida o token (usado pela página para mostrar/ocultar o formulário).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    const record = await findValidToken(token);
    return NextResponse.json({ valid: !!record });
  } catch {
    return NextResponse.json({ valid: false });
  }
}

// Define a nova palavra-passe.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = (body?.token ?? "").trim();
    const password = body?.password ?? "";

    if (!token || !password) {
      return NextResponse.json(
        { message: "Pedido inválido." },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { message: "A palavra-passe deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const record = await findValidToken(token);
    if (!record) {
      return NextResponse.json(
        { message: "O link é inválido ou expirou. Solicite um novo." },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      prisma.pontoPasswordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao redefinir palavra-passe:", e);
    return NextResponse.json(
      { message: "Erro ao alterar a palavra-passe." },
      { status: 500 }
    );
  }
}
