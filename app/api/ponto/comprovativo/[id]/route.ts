import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { verifyPayslipToken } from "@/lib/ponto/payslip-pdf";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/ponto/s3";

export const dynamic = "force-dynamic";

// Descarrega o comprovativo (anexo) de uma falta justificada.
// Autorização: sessão de administrador OU token assinado (para os links do PDF
// de assiduidade enviado à contabilidade). Redireciona para o URL do ficheiro.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const token = request.nextUrl.searchParams.get("token") || "";

  let authorized = false;
  if (token && verifyPayslipToken(id, token)) {
    authorized = true;
  } else {
    const guard = await requireAdmin();
    if (guard.ok) authorized = true;
  }
  if (!authorized) {
    return NextResponse.json({ message: "Sem permissão para aceder ao comprovativo." }, { status: 401 });
  }

  try {
    const absence = await prisma.absence.findUnique({ where: { id } });
    if (!absence || !absence.attachmentPath) {
      return NextResponse.json({ message: "Comprovativo não encontrado." }, { status: 404 });
    }
    const guessType = (absence.attachmentName ?? "").match(/\.(png|jpe?g|gif|webp)$/i)
      ? "image/jpeg"
      : (absence.attachmentName ?? "").match(/\.pdf$/i)
      ? "application/pdf"
      : "application/octet-stream";
    const url = await getFileUrl(absence.attachmentPath, guessType, absence.attachmentPublic);
    return NextResponse.redirect(url);
  } catch (e: any) {
    console.error("Erro ao obter comprovativo:", e?.message || e);
    return NextResponse.json({ message: "Não foi possível obter o comprovativo." }, { status: 500 });
  }
}
