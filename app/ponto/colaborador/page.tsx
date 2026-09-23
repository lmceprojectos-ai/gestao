import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AppHeader } from "@/components/ponto/app-header";
import { prisma } from "@/lib/db";
import { effectivePontoRole, canPontoAdmin } from "@/lib/ponto/roles";
import { ColaboradorClient } from "./colaborador-client";

export const dynamic = "force-dynamic";

export default async function ColaboradorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const r = effectivePontoRole(session.user.pontoRole, session.user.role);
  if (r === "QR") redirect("/ponto/presenca");

  // Um administrador do ponto pode ver esta vista de colaborador (modo "Ver como
  // utilizador"). Não é reencaminhado para a administração; em vez disso mostra-se
  // o botão "Ver como administrador" no cabeçalho para voltar à administração.
  const canBeAdmin = canPontoAdmin(session.user.role, session.user.pontoRole);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { partTime: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader name={session.user.name ?? "Colaborador"} role={session.user.role ?? "COLABORADOR"} email={session.user.email ?? undefined} canBeAdmin={canBeAdmin} />
      <ColaboradorClient userName={session.user.name ?? "Colaborador"} partTime={!!dbUser?.partTime} />
    </div>
  );
}
