import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lista todas as fichas dos colaboradores (uma por colaborador ativo).
// Cria automaticamente uma ficha vazia para colaboradores que ainda não têm.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  try {
    const users = await prisma.user.findMany({
      where: { isPontoUser: true, pontoRole: "COLABORADOR" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        clientFile: {
          include: { documents: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    const files = users.map((u) => ({
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      file: u.clientFile,
    }));
    return NextResponse.json({ files });
  } catch (e) {
    console.error("Erro ao listar fichas:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
