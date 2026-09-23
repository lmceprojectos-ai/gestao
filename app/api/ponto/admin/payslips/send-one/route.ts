import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { sendSingleAccountingEmail } from "@/lib/ponto/payslip-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Envia à contabilidade, por email, o recibo de UM colaborador para um mês.
// Body: { userId, month: "AAAA-MM" }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const userId = String(body?.userId ?? "").trim();
    const month = String(body?.month ?? "").trim();
    if (!userId) {
      return NextResponse.json({ message: "Colaborador em falta." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ message: "Indique um mês válido (AAAA-MM)." }, { status: 400 });
    }

    const result = await sendSingleAccountingEmail(month, userId);
    if (!result.success) {
      return NextResponse.json({ message: result.message ?? "Não foi possível enviar." }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("Erro ao enviar recibo à contabilidade:", e);
    return NextResponse.json({ message: "Erro ao enviar o recibo." }, { status: 500 });
  }
}
