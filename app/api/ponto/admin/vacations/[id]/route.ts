import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplate } from "@/lib/ponto/notifications";
import { weekdaysBetween } from "@/lib/ponto/schedule";

export const dynamic = "force-dynamic";

const VALID = ["PENDENTE", "APROVADA", "REJEITADA"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    const body = await request.json();
    const status = body?.status;
    const decisionNote = (body?.decisionNote ?? "").trim() || null;
    if (!VALID.includes(status)) {
      return NextResponse.json({ message: "Estado inválido." }, { status: 400 });
    }

    const vacation = await prisma.vacationRequest.update({
      where: { id: params.id },
      data: {
        status,
        decisionNote,
        decidedBy: guard.session.user.id,
        decidedAt: new Date(),
      },
      include: { user: { select: { name: true, email: true } } },
    });

    // Ao aprovar, regista as férias como ausencias justificadas (dias úteis)
    if (status === "APROVADA") {
      const days = weekdaysBetween(vacation.startDate, vacation.endDate);
      for (const ds of days) {
        const existing = await prisma.absence.findFirst({
          where: { userId: vacation.userId, absenceDate: ds },
        });
        if (existing) {
          await prisma.absence.update({
            where: { id: existing.id },
            data: {
              status: "JUSTIFICADA",
              reason: "Férias",
              observation: "Férias aprovadas pela administração",
              decisionNote: decisionNote ?? "Férias aprovadas",
              decidedBy: guard.session.user.id,
              decidedAt: new Date(),
            },
          });
        } else {
          await prisma.absence.create({
            data: {
              userId: vacation.userId,
              absenceDate: ds,
              status: "JUSTIFICADA",
              reason: "Férias",
              observation: "Férias aprovadas pela administração",
              decisionNote: decisionNote ?? "Férias aprovadas",
              decidedBy: guard.session.user.id,
              decidedAt: new Date(),
            },
          });
        }
      }
    }

    // Ao rejeitar, remove ausencias de férias que tenham sido criadas para este periodo
    if (status === "REJEITADA") {
      const days = weekdaysBetween(vacation.startDate, vacation.endDate);
      await prisma.absence.deleteMany({
        where: { userId: vacation.userId, absenceDate: { in: days }, reason: "Férias" },
      });
    }

    const statusLabel = status === "APROVADA" ? "Aprovado" : status === "REJEITADA" ? "Rejeitado" : "Pendente";
    if (status === "APROVADA" || status === "REJEITADA") {
      sendEmail({
        notificationId: process.env.NOTIF_ID_DECISO_SOBRE_PEDIDO_DE_FRIAS,
        subject: `O seu pedido de férias foi ${statusLabel.toLowerCase()}`,
        recipientEmail: vacation.user.email,
        body: emailTemplate("Decisão sobre o seu pedido de férias", [
          ["Período", `${vacation.startDate} a ${vacation.endDate}`],
          ["Dias úteis", String(vacation.days)],
          ["Decisão", statusLabel],
          ["Nota da administração", decisionNote ?? "—"],
        ]),
      });
    }

    return NextResponse.json({ success: true, vacation });
  } catch (e) {
    console.error("Erro ao decidir pedido de férias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    await prisma.vacationRequest.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Erro ao remover pedido de férias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
