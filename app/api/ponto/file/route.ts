import { canPontoAdmin } from "@/lib/ponto/roles";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/ponto/s3";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const absenceId = searchParams.get("absenceId");
    if (!absenceId) {
      return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
    }
    const absence = await prisma.absence.findUnique({ where: { id: absenceId } });
    if (!absence || !absence.attachmentPath) {
      return NextResponse.json({ message: "Ficheiro não encontrado." }, { status: 404 });
    }
    // colaborador só vê os seus; admin vê todos
    const isAdmin = canPontoAdmin(session.user.role, (session.user as any).pontoRole);
    if (!isAdmin && absence.userId !== session.user.id) {
      return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
    }
    const guessType = (absence.attachmentName ?? "").match(/\.(png|jpe?g|gif|webp)$/i)
      ? "image/jpeg"
      : "application/octet-stream";
    const url = await getFileUrl(absence.attachmentPath, guessType, false);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Erro ao obter ficheiro:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
