import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// O colaborador acrescenta uma fotografia de documento à sua própria ficha.
// Não existe DELETE aqui: depois de carregado, só o admin pode remover/substituir.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await request.json();
    const cloud_storage_path = body?.cloud_storage_path;
    const fileName = body?.fileName;
    if (!cloud_storage_path || !fileName) {
      return NextResponse.json({ message: "Dados do ficheiro em falta." }, { status: 400 });
    }
    const file = await prisma.clientFile.upsert({
      where: { userId },
      update: {},
      create: { userId, fullName: session.user.name ?? null },
    });
    const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : null;
    const side = typeof body?.side === "string" && body.side.trim() ? body.side.trim() : null;

    // Regra: depois de carregado, só o administrador pode alterar. Por isso, se já
    // existir um documento do mesmo tipo/lado, o colaborador não o pode substituir.
    // Para documentos sem lado (ex.: comprovativo de IBAN) a verificação é só por categoria.
    if (category) {
      const existing = await prisma.clientDocument.findFirst({
        where: { clientFileId: file.id, category, side },
      });
      if (existing) {
        return NextResponse.json(
          { message: "Este documento já foi carregado. Só o administrador o pode alterar." },
          { status: 409 }
        );
      }
    }

    await prisma.clientDocument.create({
      data: {
        clientFileId: file.id,
        label: typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null,
        category,
        side,
        cloud_storage_path,
        fileName,
        contentType: body?.contentType ?? "application/octet-stream",
        uploadedBy: userId,
      },
    });
    const updated = await prisma.clientFile.findUnique({
      where: { id: file.id },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ file: updated });
  } catch (e) {
    console.error("Erro ao carregar documento:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
