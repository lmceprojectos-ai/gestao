import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";

export const dynamic = "force-dynamic";

// Edita um perfil salarial. O IRS NÃO é editável (é definido pelo Estado).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const num = (v: any) => {
      const x = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
      return Number.isFinite(x) ? x : 0;
    };
    const data: any = {};
    if (body.vencimentoBase !== undefined) data.vencimentoBase = num(body.vencimentoBase);
    if (body.periodRate !== undefined) data.periodRate = num(body.periodRate);
    if (body.mealPerDay !== undefined) data.mealPerDay = num(body.mealPerDay);
    if (body.subsFerias !== undefined) data.subsFerias = num(body.subsFerias);
    if (body.subsNatal !== undefined) data.subsNatal = num(body.subsNatal);
    if (body.ssRate !== undefined) data.ssRate = num(body.ssRate);
    if (body.category !== undefined) data.category = body.category ? String(body.category) : null;
    // irsRate deliberadamente ignorado — IRS é definido pelo Estado.

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada para atualizar." }, { status: 400 });
    }

    const profile = await prisma.salaryProfile.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ success: true, profile });
  } catch (e) {
    console.error("Erro ao atualizar perfil salarial:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Remove um perfil salarial.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    await prisma.salaryProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover perfil salarial:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
