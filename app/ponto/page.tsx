import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { effectivePontoRole, canPontoAdmin } from "@/lib/ponto/roles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const r = effectivePontoRole(session.user.pontoRole, session.user.role);
  if (r === "QR") {
    redirect("/ponto/presenca");
  }
  // Só quem pode administrar o ponto (admin da Gestão ou conta ADMIN de ponto)
  // entra por defeito na vista de administração. O botão "Ver como utilizador"
  // grava o cookie ponto_view_mode=user para passar a ver a vista de colaborador.
  const admin = canPontoAdmin(session.user.role, session.user.pontoRole);
  const viewMode = cookies().get("ponto_view_mode")?.value;
  if (admin && viewMode !== "user") {
    redirect("/ponto/admin");
  }
  redirect("/ponto/colaborador");
}
