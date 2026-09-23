import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { computeUserBonusForMonth } from "@/lib/ponto/bonus-data";
import { getLisbonParts } from "@/lib/ponto/schedule";
import {
  BONUS_VALUE,
  BONUS_MAX_UNJUSTIFIED_DELAYS,
} from "@/lib/ponto/bonus";

export const dynamic = "force-dynamic";

// Estado do prémio de assiduidade e pontualidade do colaborador para um mês.
// Sem parâmetro usa o mês corrente (Europe/Lisbon).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const now = getLisbonParts(new Date());
    const curMonth = `${now.year}-${String(now.month).padStart(2, "0")}`;
    const monthParam = url.searchParams.get("month");
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : curMonth;

    const bonus = await computeUserBonusForMonth(session.user.id, month);

    return NextResponse.json({
      month,
      value: BONUS_VALUE,
      maxDelays: BONUS_MAX_UNJUSTIFIED_DELAYS,
      ...bonus,
    });
  } catch (e) {
    console.error("Erro ao calcular o prémio de assiduidade:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
