import { NextRequest, NextResponse } from "next/server";
import { getLisbonParts } from "@/lib/ponto/schedule";
import { sendPayslipEmailsForMonth } from "@/lib/ponto/payslip-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  // Permite também via query param para acionamento manual seguro
  const qp = req.nextUrl.searchParams.get("secret");
  return qp === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Determina o mês a fechar. Por defeito o mês atual (Europe/Lisbon).
  // Permite override via ?month=AAAA-MM para reenvio manual.
  const override = req.nextUrl.searchParams.get("month");
  let month: string;
  if (override && /^\d{4}-\d{2}$/.test(override)) {
    month = override;
  } else {
    const parts = getLisbonParts(new Date());
    month = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }

  const result = await sendPayslipEmailsForMonth(month, {
    generate: true,
    trigger: "auto",
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
