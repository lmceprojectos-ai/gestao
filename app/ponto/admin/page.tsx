import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { effectivePontoRole, canPontoAdmin } from "@/lib/ponto/roles";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const r = effectivePontoRole(session.user.pontoRole, session.user.role);
  if (r === "QR") redirect("/ponto/presenca");
  // Editor / Inserção / Leitura / Colaborador não têm acesso à administração do ponto.
  if (!canPontoAdmin(session.user.role, session.user.pontoRole)) redirect("/ponto/colaborador");
  return (
    <div className="min-h-screen bg-background">
      <AdminClient name={session.user.name ?? "Administrador"} email={session.user.email ?? undefined} />
    </div>
  );
}
