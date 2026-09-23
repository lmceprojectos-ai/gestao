import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { PAYSLIP_NUMERIC_FIELDS, PayslipEntry } from "@/lib/ponto/payslip";

export const dynamic = "force-dynamic";

// Lista todos os recibos guardados (ordenados por mês, mais recente primeiro).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const payslips = await prisma.payslip.findMany({
      orderBy: [{ month: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ payslips });
  } catch (e) {
    console.error("Erro ao obter recibos:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Guarda (ou atualiza) os recibos de um mês.
// Body: { month: "AAAA-MM", entries: PayslipEntry[] }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const month = String(body?.month ?? "").trim();
    const entries: PayslipEntry[] = Array.isArray(body?.entries) ? body.entries : [];
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ message: "Indique um mês válido (AAAA-MM)." }, { status: 400 });
    }
    if (entries.length === 0) {
      return NextResponse.json({ message: "Não há registos para guardar." }, { status: 400 });
    }

    // Utilizadores existentes para tentar associar cada recibo a uma conta.
    const users = await prisma.user.findMany({ where: { isPontoUser: true }, select: { id: true, name: true, email: true } });
    const matchUser = (name: string): string | null => {
      const n = name.toLowerCase().trim();
      const exact = users.find((u) => (u.name ?? "").toLowerCase().trim() === n);
      if (exact) return exact.id;
      // correspondência parcial pelo primeiro e último nome
      const partial = users.find((u) => {
        const un = (u.name ?? "").toLowerCase();
        const parts = n.split(/\s+/);
        return parts.length > 1 && un.includes(parts[0]) && un.includes(parts[parts.length - 1]);
      });
      return partial?.id ?? null;
    };

    const num = (v: any) => {
      const x = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
      return Number.isFinite(x) ? x : 0;
    };

    let saved = 0;
    for (const e of entries) {
      const name = String(e?.name ?? "").trim();
      if (!name) continue;
      const numericData: any = {};
      for (const f of PAYSLIP_NUMERIC_FIELDS) numericData[f] = num((e as any)[f]);
      const data = {
        month,
        name,
        employeeNumber: e.employeeNumber ? String(e.employeeNumber) : null,
        category: e.category ? String(e.category) : null,
        userId: matchUser(name),
        ...numericData,
        breakdown: e.breakdown ?? undefined,
      };
      await prisma.payslip.upsert({
        where: { month_name: { month, name } },
        update: data,
        create: data,
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved, month });
  } catch (e) {
    console.error("Erro ao guardar recibos:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
