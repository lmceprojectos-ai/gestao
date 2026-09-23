import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Devolve a ficha do colaborador autenticado (cria vazia se ainda não existir).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const userId = session.user.id;
    let file = await prisma.clientFile.findUnique({
      where: { userId },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });
    if (!file) {
      file = await prisma.clientFile.create({
        data: { userId, fullName: session.user.name ?? null },
        include: { documents: { orderBy: { createdAt: "asc" } } },
      });
    }
    return NextResponse.json({ file });
  } catch (e) {
    console.error("Erro ao obter ficha:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// O colaborador pode editar os dados textuais da sua ficha (nome, morada, etc).
// Não pode mexer nas fotografias dos documentos (nem apagar nem substituir).
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const userId = session.user.id;
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
    console.error("Erro ao guardar ficha:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
