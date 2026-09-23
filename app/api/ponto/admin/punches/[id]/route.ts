import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { computeDelays, getLisbonParts } from "@/lib/ponto/schedule";
import { regeneratePayslipIfExists } from "@/lib/ponto/payslip-generate";

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
    const before = await prisma.timeRecord.findUnique({ where: { id: params.id } });
    const data: any = { correctedBy: guard.session.user.id };
    if (body?.datetime) {
      const ts = new Date(body.datetime);
      if (isNaN(ts.getTime())) {
        return NextResponse.json({ message: "Data/hora inválida." }, { status: 400 });
      }
      const type = body?.type ?? before?.type ?? "ENTRADA";
      const { lateMinutes, extraMinutes } = computeDelays(type, ts);
      data.timestamp = ts;
      data.workDate = getLisbonParts(ts).dateStr;
      data.lateMinutes = lateMinutes;
      data.extraMinutes = extraMinutes;
      if (body?.type) data.type = body.type;
    }
    if (typeof body?.note === "string") data.note = body.note.trim();
    const record = await prisma.timeRecord.update({ where: { id: params.id }, data });
    // Correção de assiduidade: recalcula o(s) recibo(s) afetado(s), se existirem.
    // Cobre tanto o mês novo como o antigo (caso a data tenha sido alterada).
    const months = new Set<string>();
    if (record.workDate) months.add(record.workDate.slice(0, 7));
    if (before?.workDate) months.add(before.workDate.slice(0, 7));
    for (const m of Array.from(months)) {
      await regeneratePayslipIfExists(record.userId, m);
    }
    return NextResponse.json({ success: true, record });
  } catch (e) {
    console.error("Erro ao corrigir marcação:", e);
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
    const before = await prisma.timeRecord.findUnique({ where: { id: params.id } });
    await prisma.timeRecord.delete({ where: { id: params.id } });
    // Correção de assiduidade: recalcula o recibo do mês, se existir.
    if (before?.userId && before?.workDate) {
      await regeneratePayslipIfExists(before.userId, before.workDate.slice(0, 7));
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover marcação:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
