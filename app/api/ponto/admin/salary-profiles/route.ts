import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { deriveProfile } from "@/lib/ponto/payroll";
import type { PayslipEntry } from "@/lib/ponto/payslip";

export const dynamic = "force-dynamic";

// Lista os perfis salariais aprendidos.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const profiles = await prisma.salaryProfile.findMany({
      orderBy: [{ name: "asc" }],
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ profiles });
  } catch (e) {
    console.error("Erro ao obter perfis salariais:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Cria/atualiza perfis salariais a partir das entradas revistas do PDF.
// Body: { refMonth: "AAAA-MM", entries: PayslipEntry[] }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const refMonth = String(body?.refMonth ?? "").trim();
    const entries: PayslipEntry[] = Array.isArray(body?.entries) ? body.entries : [];
    if (!/^\d{4}-\d{2}$/.test(refMonth)) {
      return NextResponse.json(
        { message: "Indique um mês de referência válido (AAAA-MM)." },
        { status: 400 }
      );
    }
    if (entries.length === 0) {
      return NextResponse.json({ message: "Não há perfis para guardar." }, { status: 400 });
    }

    const users = await prisma.user.findMany({ where: { isPontoUser: true }, select: { id: true, name: true } });
    const matchUser = (name: string): string | null => {
      const n = name.toLowerCase().trim();
      const exact = users.find((u) => (u.name ?? "").toLowerCase().trim() === n);
      if (exact) return exact.id;
      const partial = users.find((u) => {
        const un = (u.name ?? "").toLowerCase();
        const parts = n.split(/\s+/);
        return parts.length > 1 && un.includes(parts[0]) && un.includes(parts[parts.length - 1]);
      });
      return partial?.id ?? null;
    };

    let saved = 0;
    for (const e of entries) {
      const name = String(e?.name ?? "").trim();
      if (!name) continue;
      const derived = deriveProfile(e, refMonth);
      const userId = matchUser(name);
      const data: any = {
        name,
        employeeNumber: e.employeeNumber ? String(e.employeeNumber) : null,
        category: e.category ? String(e.category) : null,
        userId,
        ...derived,
        refMonth,
        refData: e as any,
      };
      // Evita conflito de userId único caso já exista noutro perfil.
      await prisma.salaryProfile.upsert({
        where: { name },
        update: data,
        create: data,
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved });
  } catch (e) {
    console.error("Erro ao guardar perfis salariais:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
