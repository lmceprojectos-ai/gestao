import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import {
  buildAccountingEmail,
  getMonthPayslips,
  getEligiblePayslips,
  ACCOUNTING_RECIPIENTS,
} from "@/lib/ponto/payslip-email";

export const dynamic = "force-dynamic";

// Devolve o HTML exato do email enviado à contabilidade, para pré-visualização
// no painel. ?month=AAAA-MM
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });

  const month = req.nextUrl.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ message: "Indique um mês válido (AAAA-MM)." }, { status: 400 });
  }

  try {
    const payslips = await getMonthPayslips(month);
    if (payslips.length === 0) {
      return NextResponse.json({
        empty: true,
        message: "Ainda não há recibos gerados para este mês.",
      });
    }

    const eligible = await getEligiblePayslips(month, payslips);
    if (eligible.length === 0) {
      return NextResponse.json({
        empty: true,
        recipients: ACCOUNTING_RECIPIENTS,
        message:
          "Nenhum colaborador está marcado para envio à contabilidade neste mês.",
      });
    }
    const { subject, body } = buildAccountingEmail(month, eligible);
    return NextResponse.json({
      subject,
      html: body,
      recipients: ACCOUNTING_RECIPIENTS,
      count: eligible.length,
    });
  } catch (e) {
    console.error("Erro ao pré-visualizar email:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
