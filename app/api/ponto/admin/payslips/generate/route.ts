import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { generatePayslipsForMonth } from "@/lib/ponto/payslip-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gera automaticamente os recibos de um mês a partir dos perfis salariais e
// do calendário de pontos. Body: { month: "AAAA-MM" }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const month = String(body?.month ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ message: "Indique um mês válido (AAAA-MM)." }, { status: 400 });
    }

    const { rows } = await generatePayslipsForMonth(month);
    if (rows.length === 0) {
      return NextResponse.json({
        message:
          "Não existem perfis salariais. Importe primeiro um PDF de recibos para aprender os perfis.",
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, month, count: rows.length, rows });
  } catch (e) {
    console.error("Erro ao gerar recibos:", e);
    return NextResponse.json({ message: "Erro ao gerar os recibos." }, { status: 500 });
  }
}
