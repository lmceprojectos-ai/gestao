import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { verifyPayslipToken, generatePayslipPdfById } from "@/lib/ponto/payslip-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Descarrega o recibo de remunerações em PDF (design idêntico ao recibo oficial).
// Autorização: sessão de administrador OU token assinado (para os links de email).
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
    return NextResponse.json({ message: "Sem permissão para aceder ao recibo." }, { status: 401 });
  }

  try {
    const result = await generatePayslipPdfById(id);
    if (!result) {
      return NextResponse.json({ message: "Recibo não encontrado." }, { status: 404 });
    }
    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("Erro ao gerar PDF do recibo:", e?.message || e);
    return NextResponse.json({ message: "Não foi possível gerar o PDF do recibo." }, { status: 500 });
  }
}
