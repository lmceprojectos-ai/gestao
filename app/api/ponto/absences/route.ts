import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplate, ADMIN_EMAIL } from "@/lib/ponto/notifications";
import { ABSENCE_LABELS } from "@/lib/ponto/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const absences = await prisma.absence.findMany({
      where: { userId: session.user.id },
      orderBy: { absenceDate: "desc" },
    });
    return NextResponse.json({ absences });
  } catch (e) {
    console.error("Erro ao listar faltas:", e);
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
    const absenceDate = body?.absenceDate;
    const reason = (body?.reason ?? "").trim();
    const observation = (body?.observation ?? "").trim() || null;
    const attachmentPath = body?.attachmentPath || null;
    const attachmentName = body?.attachmentName || null;
    const declaredType = body?.declaredType === "INJUSTIFICADA" ? "INJUSTIFICADA" : "JUSTIFICADA";
    if (!absenceDate || !reason) {
      return NextResponse.json(
        { message: "Data e motivo são obrigatórios." },
        { status: 400 }
      );
    }
    if (declaredType === "JUSTIFICADA" && !attachmentPath) {
      return NextResponse.json(
        { message: "Para uma falta justificada tem de anexar o comprovativo." },
        { status: 400 }
      );
    }
    // Falta justificada fica "EM_ANALISE" (o administrador valida o comprovativo);
    // falta injustificada é registada diretamente como INJUSTIFICADA.
    const status = declaredType === "INJUSTIFICADA" ? "INJUSTIFICADA" : "EM_ANALISE";
    const absence = await prisma.absence.create({
      data: {
        userId: session.user.id,
        absenceDate,
        reason,
        observation,
        attachmentPath,
        attachmentName,
        status,
      },
    });

    sendEmail({
      notificationId: process.env.NOTIF_ID_NOVA_JUSTIFICAO_DE_FALTA,
      subject: `Nova falta (${declaredType === "INJUSTIFICADA" ? "injustificada" : "justificada"}) — ${session.user.name}`,
      recipientEmail: ADMIN_EMAIL,
      body: emailTemplate("Nova falta registada", [
        ["Colaborador", session.user.name ?? ""],
        ["Email", session.user.email ?? ""],
        ["Data da falta", absenceDate],
        ["Tipo declarado", declaredType === "INJUSTIFICADA" ? "Injustificada" : "Justificada"],
        ["Motivo", reason],
        ["Observação", observation ?? "—"],
        ["Estado", ABSENCE_LABELS[status]],
        ["Comprovativo", attachmentName ? "Sim (anexo)" : "Não"],
      ], "Aceda à área de administração para analisar e decidir sobre esta falta."),
    });

    return NextResponse.json({ success: true, absence });
  } catch (e) {
    console.error("Erro ao criar justificação:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
