import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { normalizeIp } from "@/lib/ponto/ip";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  const ips = await prisma.allowedIp.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ips });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json();
    const address = normalizeIp((body?.address ?? "").trim());
    const label = (body?.label ?? "").trim() || null;
    if (!address) {
      return NextResponse.json({ message: "Endereço IP obrigatório." }, { status: 400 });
    }
    const existing = await prisma.allowedIp.findUnique({ where: { address } });
    if (existing) {
      return NextResponse.json({ message: "IP já autorizado." }, { status: 409 });
    }
    const ip = await prisma.allowedIp.create({ data: { address, label } });
    return NextResponse.json({ success: true, ip });
  } catch (e) {
    console.error("Erro ao adicionar IP:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
