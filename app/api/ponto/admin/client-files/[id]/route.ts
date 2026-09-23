import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// O admin pode alterar qualquer dado da ficha de um colaborador.
// [id] = userId do colaborador (a ficha é criada se ainda não existir).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    const userId = params.id;
    const body = await request.json();
    const data = {
      fullName: typeof body?.fullName === "string" ? body.fullName.trim() : undefined,
      address: typeof body?.address === "string" ? body.address.trim() : undefined,
      phone: typeof body?.phone === "string" ? body.phone.trim() : undefined,
      nif: typeof body?.nif === "string" ? body.nif.trim() : undefined,
      notes: typeof body?.notes === "string" ? body.notes.trim() : undefined,
    };
    const file = await prisma.clientFile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ file });
  } catch (e) {
    console.error("Erro ao guardar ficha (admin):", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
