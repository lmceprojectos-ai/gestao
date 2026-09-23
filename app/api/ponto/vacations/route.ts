import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplate, ADMIN_EMAIL } from "@/lib/ponto/notifications";
import { countWeekdays } from "@/lib/ponto/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const vacations = await prisma.vacationRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json({ vacations });
  } catch (e) {
    console.error("Erro ao listar pedidos de férias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const body = await request.json();
    const startDate = body?.startDate;
    const endDate = body?.endDate;
    const reason = (body?.reason ?? "").trim() || null;
    if (!startDate || !endDate) {
      return NextResponse.json({ message: "Indique a data de início e de fim." }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ message: "A data de fim não pode ser anterior à de início." }, { status: 400 });
    }
    const days = countWeekdays(startDate, endDate);
    if (days <= 0) {
      return NextResponse.json({ message: "O período selecionado não contém dias úteis." }, { status: 400 });
    }

    const vacation = await prisma.vacationRequest.create({
      data: {
        userId: session.user.id,
        startDate,
        endDate,
        days,
        reason,
        status: "PENDENTE",
      },
    });

    sendEmail({
      notificationId: process.env.NOTIF_ID_NOVO_PEDIDO_DE_FRIAS,
      subject: `Novo pedido de férias — ${session.user.name}`,
      recipientEmail: ADMIN_EMAIL,
      body: emailTemplate("Novo pedido de férias", [
        ["Colaborador", session.user.name ?? ""],
        ["Email", session.user.email ?? ""],
        ["De", startDate],
        ["Até", endDate],
        ["Dias úteis", String(days)],
        ["Motivo", reason ?? "—"],
        ["Estado", "Pendente de aprovação"],
      ], "Aceda à área de administração, separador Férias, para aprovar ou rejeitar este pedido."),
    });

    return NextResponse.json({ success: true, vacation });
  } catch (e) {
    console.error("Erro ao criar pedido de férias:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
