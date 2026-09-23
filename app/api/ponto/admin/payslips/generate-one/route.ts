import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { generatePayslipsForMonth } from "@/lib/ponto/payslip-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gera o recibo (e o ponto de assiduidade) de UM colaborador para um mês.
// Se o colaborador ainda não tiver perfil salarial, cria um perfil mínimo
// (valores a zero) para que passe a aparecer na área de recibos. Os valores
// salariais devem depois ser preenchidos em Recibos → Perfis salariais.
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: "Colaborador não encontrado." }, { status: 404 });
    }

    // Garante que existe um perfil salarial para este colaborador.
    let createdProfile = false;
    const existing = await prisma.salaryProfile.findUnique({ where: { userId } });
    if (!existing) {
      const profileName = (user.name && user.name.trim()) || user.email || `Colaborador ${userId.slice(-6)}`;
      // O nome do perfil é único; se já existir um perfil com este nome sem
      // utilizador associado, associa-o a este colaborador em vez de duplicar.
      const byName = await prisma.salaryProfile.findUnique({ where: { name: profileName } });
      if (byName) {
        await prisma.salaryProfile.update({ where: { id: byName.id }, data: { userId } });
      } else {
        await prisma.salaryProfile.create({
          data: {
            name: profileName,
            userId,
            vencimentoBase: 0,
            mealPerDay: 0,
            subsFerias: 0,
            subsNatal: 0,
            ssRate: 0.11,
            irsRate: 0,
          },
        });
        createdProfile = true;
      }
    }

    await generatePayslipsForMonth(month, { userId });

    return NextResponse.json({ success: true, month, createdProfile });
  } catch (e) {
    console.error("Erro ao gerar recibo do colaborador:", e);
    return NextResponse.json({ message: "Erro ao gerar o recibo." }, { status: 500 });
  }
}
