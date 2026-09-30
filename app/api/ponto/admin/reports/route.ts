import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { workedMinutesForDay } from "@/lib/ponto/schedule";
import { aplicarPresencaAutomatica } from "@/lib/ponto/presenca-automatica";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  await aplicarPresencaAutomatica().catch((e) => console.error("Presença automática:", e));

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  const from = month ? `${month}-01` : searchParams.get("from") ?? "0000-01-01";
  const to = month ? `${month}-31` : searchParams.get("to") ?? "9999-12-31";

  // Apenas colaboradores do ponto entram nos relatórios (sem admin do ponto nem
  // ecrã de presença). Usa o perfil de ponto dedicado (pontoRole) para incluir
  // também colaboradores que tenham perfil de Gestão na conta.
  const users = await prisma.user.findMany({
    where: { isPontoUser: true, pontoRole: "COLABORADOR" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  const punches = await prisma.timeRecord.findMany({
    where: { workDate: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
  });
  const absences = await prisma.absence.findMany({
    where: { absenceDate: { gte: from, lte: to } },
  });

  const report = users.map((u) => {
    const userPunches = punches.filter((p) => p.userId === u.id);
    const days = new Map<string, { type: string; timestamp: Date }[]>();
    let lateMinutes = 0;
    let extraMinutes = 0;
    for (const p of userPunches) {
      lateMinutes += p.lateMinutes ?? 0;
      extraMinutes += p.extraMinutes ?? 0;
      const arr = days.get(p.workDate) ?? [];
      arr.push({ type: p.type, timestamp: p.timestamp });
      days.set(p.workDate, arr);
    }
    let workedMinutes = 0;
    const daysArr = Array.from(days.entries());
    for (const [, dp] of daysArr) {
      workedMinutes += workedMinutesForDay(dp);
    }
    const userAbsences = absences.filter((a) => a.userId === u.id);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      daysWorked: days.size,
      workedMinutes,
      lateMinutes,
      extraMinutes,
      absencesTotal: userAbsences.length,
      absencesJustified: userAbsences.filter((a) => a.status === "JUSTIFICADA").length,
      absencesUnjustified: userAbsences.filter((a) => a.status === "INJUSTIFICADA").length,
      absencesPending: userAbsences.filter(
        (a) => a.status === "EM_ANALISE" || a.status === "POR_JUSTIFICAR"
      ).length,
    };
  });

  return NextResponse.json({ report, from, to, colaboradores: users.length });
}
