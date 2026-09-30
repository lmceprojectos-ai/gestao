import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { computeDelays, getLisbonParts } from "@/lib/ponto/schedule";
import { regeneratePayslipIfExists } from "@/lib/ponto/payslip-generate";
import { aplicarPresencaAutomatica } from "@/lib/ponto/presenca-automatica";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  await aplicarPresencaAutomatica().catch((e) => console.error("Presença automática:", e));
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where: any = {};
  if (userId) where.userId = userId;
  if (from || to) {
    where.workDate = {};
    if (from) where.workDate.gte = from;
    if (to) where.workDate.lte = to;
  }
  const punches = await prisma.timeRecord.findMany({
    where,
    orderBy: { timestamp: "desc" },
    include: { user: { select: { name: true, email: true } } },
    take: 1000,
  });
  return NextResponse.json({ punches });
}

// Admin cria/corrige marcação manualmente
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const userId = body?.userId;
    const type = body?.type;
    const datetime = body?.datetime; // ISO string
    const note = (body?.note ?? "").trim() || "Registo criado pelo administrador";
    if (!userId || !type || !datetime) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }
    const ts = new Date(datetime);
    if (isNaN(ts.getTime())) {
      return NextResponse.json({ message: "Data/hora inválida." }, { status: 400 });
    }
    const parts = getLisbonParts(ts);
    const { lateMinutes, extraMinutes } = computeDelays(type, ts);
    const record = await prisma.timeRecord.create({
      data: {
        userId,
        type,
        timestamp: ts,
        workDate: parts.dateStr,
        ipAddress: "manual",
        device: "Registo manual",
        lateMinutes,
        extraMinutes,
        correctedBy: guard.session.user.id,
        note,
      },
    });
    // Correção de assiduidade: recalcula o recibo do mês, se já existir.
    await regeneratePayslipIfExists(userId, parts.dateStr.slice(0, 7));
    return NextResponse.json({ success: true, record });
  } catch (e) {
    console.error("Erro ao criar marcação manual:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
