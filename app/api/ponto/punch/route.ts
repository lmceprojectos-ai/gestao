import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getClientIp, isIpAllowed, parseDevice } from "@/lib/ponto/ip";
import { computeDelays, getLisbonParts, PUNCH_LABELS } from "@/lib/ponto/schedule";
import { sendEmail, emailTemplate, ADMIN_EMAIL } from "@/lib/ponto/notifications";
import { verifyQrToken } from "@/lib/ponto/presence";

export const dynamic = "force-dynamic";

const VALID_TYPES = [
  "ENTRADA",
  "SAIDA_ALMOCO",
  "REGRESSO_ALMOCO",
  "SAIDA_FINAL",
  "HORA_EXTRA",
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const today = getLisbonParts(new Date()).dateStr;
    const punches = await prisma.timeRecord.findMany({
      where: { userId: session.user.id, workDate: today },
      orderBy: { timestamp: "asc" },
    });
    return NextResponse.json({ punches, today });
  } catch (e) {
    console.error("Erro ao obter marcações:", e);
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
    const type = body?.type;
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { message: "Tipo de marcação inválido." },
        { status: 400 }
      );
    }

    // Controlo de presença por QR obrigatório: a marcação só é válida após o
    // colaborador ler, com a câmara da aplicação, o QR que muda a cada 30 segundos
    // na conta do administrador. Sem esse código válido e recente, não regista.
    const validQr = await verifyQrToken(body?.qrToken);
    if (!validQr) {
      return NextResponse.json(
        {
          message:
            "Marcação não permitida: leia com a câmara o QR atualizado mostrado na conta do administrador.",
          qrRequired: true,
        },
        { status: 403 }
      );
    }

    const ip = getClientIp(request.headers);
    const allowed = await isIpAllowed(ip);
    if (!allowed) {
      // alerta crítico
      sendEmail({
        notificationId: process.env.NOTIF_ID_ALERTA_CRTICO_DE_ASSIDUIDADE,
        subject: "Tentativa de marcação fora da rede da empresa",
        recipientEmail: ADMIN_EMAIL,
        body: emailTemplate("Marcação bloqueada", [
          ["Colaborador", session.user.name ?? ""],
          ["Endereço IP", ip],
          ["Tipo", PUNCH_LABELS[type] ?? type],
        ], "A marcação foi bloqueada porque o dispositivo não está ligado à rede da empresa."),
      });
      return NextResponse.json(
        {
          message:
            "Marcação não permitida: o seu dispositivo não está ligado à rede da empresa.",
          ip,
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const parts = getLisbonParts(now);
    const device = parseDevice(request.headers.get("user-agent"));

    // evitar duplicado do mesmo tipo no mesmo dia (exceto HORA_EXTRA)
    if (type !== "HORA_EXTRA") {
      const existing = await prisma.timeRecord.findFirst({
        where: { userId: session.user.id, workDate: parts.dateStr, type },
      });
      if (existing) {
        return NextResponse.json(
          { message: `Já registou "${PUNCH_LABELS[type]}" hoje.` },
          { status: 409 }
        );
      }
    }

    const { lateMinutes, extraMinutes } = computeDelays(type, now);

    const record = await prisma.timeRecord.create({
      data: {
        userId: session.user.id,
        type,
        timestamp: now,
        workDate: parts.dateStr,
        ipAddress: ip,
        device,
        lateMinutes,
        extraMinutes,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (e) {
    console.error("Erro ao registar marcação:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
