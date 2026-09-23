import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { sendPayslipEmailsForMonth } from "@/lib/ponto/payslip-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Envio manual (ou reenvio) do resumo e dos recibos para a contabilidade.
// Body: { month: "AAAA-MM" }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });

  try {
    const body = await req.json().catch(() => ({}));
    const month = String(body?.month ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ message: "Indique um mês válido (AAAA-MM)." }, { status: 400 });
    }
    const result = await sendPayslipEmailsForMonth(month, {
      generate: true,
      trigger: "manual",
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Erro ao enviar recibos manualmente:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
