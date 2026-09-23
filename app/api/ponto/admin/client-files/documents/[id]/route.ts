import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/ponto/s3";

export const dynamic = "force-dynamic";

// Só o admin pode remover (ou substituir) uma fotografia de documento.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    const doc = await prisma.clientDocument.findUnique({ where: { id: params.id } });
    if (!doc) {
      return NextResponse.json({ message: "Documento não encontrado." }, { status: 404 });
    }
    try {
      await deleteFile(doc.cloud_storage_path);
    } catch (err) {
      console.error("Aviso: falha ao remover ficheiro do armazenamento:", err);
    }
    await prisma.clientDocument.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro ao remover documento:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
