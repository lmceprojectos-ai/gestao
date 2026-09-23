import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { canPontoAdmin, isPontoQR } from "@/lib/ponto/roles";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, status: 401, message: "Não autenticado." };
  }
  if (!canPontoAdmin(session.user.role, (session.user as any).pontoRole)) {
    return { ok: false as const, status: 403, message: "Sem permissão." };
  }
  return { ok: true as const, session };
}

// Permite o acesso ao QR de presença por administradores ou pela conta
// dedicada ao ecrã de presença (role QR).
export async function requirePresenceViewer() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, status: 401, message: "Não autenticado." };
  }
  if (!canPontoAdmin(session.user.role, (session.user as any).pontoRole) && !isPontoQR(session.user.role)) {
    return { ok: false as const, status: 403, message: "Sem permissão." };
  }
  return { ok: true as const, session };
}
