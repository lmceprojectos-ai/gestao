import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import {
  ACCOUNTING_RECIPIENTS,
  getAllSendLogs,
} from "@/lib/ponto/payslip-email";

export const dynamic = "force-dynamic";

// Devolve a configuração de destinatários e o registo de envios por mês,
// para o administrador poder verificar os recibos já enviados.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const logs = await getAllSendLogs();
    return NextResponse.json({
      recipients: {
        accounting: ACCOUNTING_RECIPIENTS,
      },
      logs,
    });
  } catch (e) {
    console.error("Erro ao obter estado de envios:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
