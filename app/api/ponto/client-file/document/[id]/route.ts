import { canPontoAdmin } from "@/lib/ponto/roles";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/ponto/s3";

export const dynamic = "force-dynamic";

// Devolve uma URL assinada para visualizar a fotografia de um documento.
// O colaborador só vê os documentos da sua ficha; o admin vê todos.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const doc = await prisma.clientDocument.findUnique({
      where: { id: params.id },
      include: { clientFile: true },
    });
    if (!doc) {
      return NextResponse.json({ message: "Documento não encontrado." }, { status: 404 });
    }
    const isAdmin = canPontoAdmin(session.user.role, (session.user as any).pontoRole);
    if (!isAdmin && doc.clientFile.userId !== session.user.id) {
      return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
    }
    const url = await getFileUrl(doc.cloud_storage_path, doc.contentType, false);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Erro ao obter documento:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
