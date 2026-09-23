import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { sendEmail, emailTemplate } from "@/lib/ponto/notifications";
import { ABSENCE_LABELS } from "@/lib/ponto/schedule";
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
    const status = body?.status;
    const valid = ["POR_JUSTIFICAR", "EM_ANALISE", "JUSTIFICADA", "INJUSTIFICADA"];
    if (!valid.includes(status)) {
      return NextResponse.json({ message: "Estado inválido." }, { status: 400 });
    }
    const decisionNote = (body?.decisionNote ?? "").trim() || null;
    const absence = await prisma.absence.update({
      where: { id: params.id },
      data: {
        status,
        decisionNote,
        decidedBy: guard.session.user.id,
        decidedAt: new Date(),
      },
      include: { user: { select: { name: true, email: true } } },
    });

    if (status === "JUSTIFICADA" || status === "INJUSTIFICADA") {
      sendEmail({
        notificationId: process.env.NOTIF_ID_DECISO_SOBRE_JUSTIFICAO,
        subject: `Decisão sobre a sua justificação — ${ABSENCE_LABELS[status]}`,
        recipientEmail: absence.user.email,
        body: emailTemplate("Decisão sobre justificação de falta", [
          ["Data da falta", absence.absenceDate],
          ["Novo estado", ABSENCE_LABELS[status]],
          ["Observação do administrador", decisionNote ?? "—"],
        ]),
      });
    }

    // Correção de assiduidade: recalcula o recibo do mês, se já existir.
    await regeneratePayslipIfExists(absence.userId, absence.absenceDate.slice(0, 7));

    return NextResponse.json({ success: true, absence });
  } catch (e) {
    console.error("Erro ao decidir falta:", e);
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
    const before = await prisma.absence.findUnique({ where: { id: params.id } });
    await prisma.absence.delete({ where: { id: params.id } });
    // Correção de assiduidade: recalcula o recibo do mês, se existir.
    if (before?.userId && before?.absenceDate) {
      await regeneratePayslipIfExists(before.userId, before.absenceDate.slice(0, 7));
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover falta:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
