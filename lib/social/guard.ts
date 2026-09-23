import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Acesso ao módulo Redes Sociais: apenas administradores e editores da Gestão.
export async function requireSocialAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, status: 401, message: 'Não autenticado.' };
  }
  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'editor') {
    return { ok: false as const, status: 403, message: 'Sem permissão.' };
  }
  return { ok: true as const, session };
}

export function canSocialAccess(role?: string | null) {
  return role === 'admin' || role === 'editor';
}
