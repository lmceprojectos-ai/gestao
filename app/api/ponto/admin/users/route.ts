import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { effectivePontoRole } from "@/lib/ponto/roles";
import { lerPresencaAutomatica } from "@/lib/ponto/presenca-automatica";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  // Apenas contas do módulo de ponto (colaboradores, administradores do ponto e
  // ecrã de presença). O campo `role` devolvido reflete o perfil EFETIVO de ponto,
  // para que contas que também têm perfil de Gestão (ex.: admin/editor) apareçam
  // corretamente como Colaborador.
  const rows = await prisma.user.findMany({
    where: { isPontoUser: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, pontoRole: true, active: true, sendToAccounting: true, partTime: true, createdAt: true },
  });
  const auto = await lerPresencaAutomatica();
  const users = rows.map(({ pontoRole, role, ...rest }) => ({
    ...rest,
    role: effectivePontoRole(pontoRole, role),
    presencaAutomatica: !!auto[rest.id],
  }));
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const email = (body?.email ?? "").toLowerCase().trim();
    const name = (body?.name ?? "").trim();
    const password = body?.password ?? "";
    const role = body?.role === "ADMIN" ? "ADMIN" : "COLABORADOR";
    const partTime = body?.partTime === true;
    if (!email || !name || !password) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "Email já existe." }, { status: 409 });
    }
    const hashed = await bcrypt.hash(password, 10);
    // Nova conta do módulo de ponto: guarda o perfil de ponto em `pontoRole` e
    // mantém um perfil de Gestão sem acesso à área financeira (COLABORADOR).
    const created = await prisma.user.create({
      data: { email, name, password: hashed, role: "COLABORADOR", pontoRole: role, isPontoUser: true, partTime },
      select: { id: true, email: true, name: true, pontoRole: true, role: true, active: true, partTime: true },
    });
    const { pontoRole: pr, role: gr, ...rest } = created;
    const user = { ...rest, role: pr ?? "COLABORADOR" };
    return NextResponse.json({ success: true, user });
  } catch (e) {
    console.error("Erro ao criar utilizador:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
