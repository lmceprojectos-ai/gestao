import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { regeneratePayslipIfExists } from "@/lib/ponto/payslip-generate";

export const dynamic = "force-dynamic";

// Lista os dias marcados como "tarefas diárias não feitas".
// Filtros opcionais: ?month=AAAA-MM e/ou ?userId=...
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const userId = searchParams.get("userId");
  const where: any = {};
  if (userId) where.userId = userId;
  if (month && /^\d{4}-\d{2}$/.test(month)) where.missDate = { startsWith: `${month}-` };
  const taskMisses = await prisma.dailyTaskMiss.findMany({
    where,
    orderBy: { missDate: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ taskMisses });
}

// Marca um dia como "tarefas diárias não feitas" para um colaborador.
// Body: { userId, missDate: "AAAA-MM-DD", note? }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const userId = String(body?.userId ?? "").trim();
    const missDate = String(body?.missDate ?? "").trim();
    const note = String(body?.note ?? "").trim() || null;
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(missDate)) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }
    const markedBy = guard.session.user?.id ?? null;
    const taskMiss = await prisma.dailyTaskMiss.upsert({
      where: { userId_missDate: { userId, missDate } },
      update: { note, markedBy },
      create: { userId, missDate, note, markedBy },
    });
    // Correção de assiduidade: recalcula o recibo do mês, se já existir.
    await regeneratePayslipIfExists(userId, missDate.slice(0, 7));
    return NextResponse.json({ success: true, taskMiss });
  } catch (e) {
    console.error("Erro ao marcar tarefas diárias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Remove a marca de "tarefas diárias não feitas" (ou seja, marca como feitas).
// Query: ?userId=...&missDate=AAAA-MM-DD
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const { searchParams } = new URL(request.url);
    const userId = String(searchParams.get("userId") ?? "").trim();
    const missDate = String(searchParams.get("missDate") ?? "").trim();
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(missDate)) {
      return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }
    await prisma.dailyTaskMiss.deleteMany({ where: { userId, missDate } });
    await regeneratePayslipIfExists(userId, missDate.slice(0, 7));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover marca de tarefas diárias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
