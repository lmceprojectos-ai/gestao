import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { PAYSLIP_NUMERIC_FIELDS } from "@/lib/ponto/payslip";

export const dynamic = "force-dynamic";

// Atualiza um recibo individual (edição manual dos valores).
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
    if (typeof body?.name === "string") data.name = body.name.trim();
    if (typeof body?.category === "string") data.category = body.category;
    if (typeof body?.employeeNumber === "string") data.employeeNumber = body.employeeNumber;
    for (const f of PAYSLIP_NUMERIC_FIELDS) {
      if (body[f] !== undefined) data[f] = num(body[f]);
    }
    const payslip = await prisma.payslip.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, payslip });
  } catch (e) {
    console.error("Erro ao atualizar recibo:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Remove um recibo.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    await prisma.payslip.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover recibo:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
