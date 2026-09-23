import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { regeneratePayslipIfExists } from "@/lib/ponto/payslip-generate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");
  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  const absences = await prisma.absence.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ absences });
}

// Admin cria falta manualmente para um colaborador
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const userId = body?.userId;
    const absenceDate = body?.absenceDate;
    const status = body?.status ?? "POR_JUSTIFICAR";
    if (!userId || !absenceDate) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }
    const absence = await prisma.absence.create({
      data: {
        userId,
        absenceDate,
        status,
        reason: (body?.reason ?? "").trim() || null,
        observation: (body?.observation ?? "").trim() || null,
      },
    });
    // Correção de assiduidade: recalcula o recibo do mês, se já existir.
    await regeneratePayslipIfExists(userId, String(absenceDate).slice(0, 7));
    return NextResponse.json({ success: true, absence });
  } catch (e) {
    console.error("Erro ao criar falta:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
