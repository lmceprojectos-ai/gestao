import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// O admin acrescenta uma fotografia de documento à ficha de um colaborador.
// body: { userId, cloud_storage_path, fileName, contentType?, label? }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    const body = await request.json();
    const userId = body?.userId;
    const cloud_storage_path = body?.cloud_storage_path;
    const fileName = body?.fileName;
    if (!userId || !cloud_storage_path || !fileName) {
      return NextResponse.json({ message: "Dados em falta." }, { status: 400 });
    }
    const file = await prisma.clientFile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await prisma.clientDocument.create({
      data: {
        clientFileId: file.id,
        label: typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null,
        category: typeof body?.category === "string" && body.category.trim() ? body.category.trim() : null,
        side: typeof body?.side === "string" && body.side.trim() ? body.side.trim() : null,
        cloud_storage_path,
        fileName,
        contentType: body?.contentType ?? "application/octet-stream",
        uploadedBy: guard.session.user.id,
      },
    });
    const updated = await prisma.clientFile.findUnique({
      where: { id: file.id },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ file: updated });
  } catch (e) {
    console.error("Erro ao carregar documento (admin):", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
