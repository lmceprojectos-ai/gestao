import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { effectivePontoRole } from "@/lib/ponto/roles";
import { PresencaClient } from "./presenca-client";

export const dynamic = "force-dynamic";

export default async function PresencaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Apenas a conta dedicada ao ecrã de presença (QR) ou administradores.
  const r = effectivePontoRole(session.user.pontoRole, session.user.role);
  if (r !== "QR" && r !== "ADMIN") {
    redirect("/ponto/colaborador");
  }
  return <PresencaClient />;
}
