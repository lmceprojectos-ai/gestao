import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// O colaborador explica o motivo de um atraso superior a 5 minutos.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!recordId) {
      return NextResponse.json({ message: "Marcação inválida." }, { status: 400 });
    }
    if (reason.length < 3) {
      return NextResponse.json(
        { message: "Descreva o motivo do atraso (mínimo 3 caracteres)." },
        { status: 400 }
      );
    }

    const record = await prisma.timeRecord.findUnique({ where: { id: recordId } });
    if (!record || record.userId !== session.user.id) {
      return NextResponse.json({ message: "Marcação não encontrada." }, { status: 404 });
    }
    if ((record.lateMinutes ?? 0) <= 5) {
      return NextResponse.json(
        { message: "Esta marcação não requer justificação de atraso." },
        { status: 400 }
      );
    }

    await prisma.timeRecord.update({
      where: { id: recordId },
      data: { delayReason: reason.slice(0, 500) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro ao guardar motivo de atraso:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
