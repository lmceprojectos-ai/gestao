import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { hasGestaoAccess } from "@/lib/ponto/roles";
import { definirPresencaAutomatica } from "@/lib/ponto/presenca-automatica";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const data: any = {};
    if (typeof body?.name === "string") data.name = body.name.trim();
    // O perfil editado aqui é o perfil de PONTO: escreve em `pontoRole` para não
    // alterar o perfil de Gestão de contas que também acedem à área financeira.
    if (body?.role === "ADMIN" || body?.role === "COLABORADOR") data.pontoRole = body.role;
    if (typeof body?.active === "boolean") data.active = body.active;
    if (typeof body?.sendToAccounting === "boolean") data.sendToAccounting = body.sendToAccounting;
    if (typeof body?.partTime === "boolean") data.partTime = body.partTime;
    if (body?.password) data.password = await bcrypt.hash(body.password, 10);
    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, role: true, pontoRole: true, active: true, sendToAccounting: true, partTime: true },
    });
    // Presença automática nos dias úteis (guardada nas definições do ponto)
    if (typeof body?.presencaAutomatica === "boolean") await definirPresencaAutomatica(params.id, body.presencaAutomatica);
    const { pontoRole, role, ...rest } = updated;
    const user = { ...rest, role: pontoRole ?? (role === "ADMIN" ? "ADMIN" : "COLABORADOR") };
    return NextResponse.json({ success: true, user });
  } catch (e) {
    console.error("Erro ao atualizar utilizador:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    if (guard.session.user.id === params.id) {
      return NextResponse.json({ message: "Não pode remover a sua própria conta." }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
    // Se a conta também tiver acesso à Gestão Financeira, remover só do módulo de
    // ponto (não apagar a conta, para preservar o acesso à Gestão e o histórico).
    if (target && hasGestaoAccess(target.role)) {
      await prisma.user.update({ where: { id: params.id }, data: { isPontoUser: false, pontoRole: null } });
      return NextResponse.json({ success: true, removedFromPontoOnly: true });
    }
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover utilizador:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
