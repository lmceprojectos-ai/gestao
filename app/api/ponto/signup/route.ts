import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body?.email ?? "").toLowerCase().trim();
    const password = body?.password ?? "";
    const name = (body?.name ?? "").trim();
    if (!email || !password || !name) {
      return NextResponse.json(
        { message: "Todos os campos são obrigatórios." },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { message: "Já existe uma conta com este email." },
        { status: 409 }
      );
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, password: hashed, name, role: "COLABORADOR", pontoRole: "COLABORADOR", isPontoUser: true },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro no signup:", e);
    return NextResponse.json(
      { message: "Erro ao criar conta." },
      { status: 500 }
    );
  }
}
