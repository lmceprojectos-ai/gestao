import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  const vacations = await prisma.vacationRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ vacations });
}
