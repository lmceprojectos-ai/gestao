// Quem entra nos Parceiros (conta corrente Criaconsensos ↔ Reclamarte):
//  - administradores da Gestão: entram como Criaconsensos, com permissão total;
//  - utilizadores com "empresa parceira" definida (ex.: a conta da Reclamarte).
// Cada empresa só altera os seus próprios registos; o administrador altera tudo.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import type { Company } from '@/lib/parceiros/calc';
import { hasGestaoAccess } from '@/lib/ponto/roles';

export const EMPRESAS: Company[] = ['CRIACONSENSOS', 'RECLAMARTE'];

export type UtilizadorParceiros = {
  id: string;
  name: string;
  email: string;
  company: Company | null;
  isAdmin: boolean;
  temGestao: boolean;
};

export async function utilizadorParceiros(): Promise<UtilizadorParceiros | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, parceiroEmpresa: true } });
  if (!u) return null;
  const isAdmin = u.role === 'admin';
  const empresa = EMPRESAS.includes(u.parceiroEmpresa as Company) ? (u.parceiroEmpresa as Company) : null;
  if (!isAdmin && !empresa) return null;
  return {
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    company: empresa ?? 'CRIACONSENSOS',
    isAdmin,
    temGestao: hasGestaoAccess(u.role),
  };
}

// Pode alterar um registo: administrador ou a empresa dona do registo.
export function podeAlterar(u: UtilizadorParceiros, empresaDoRegisto: string) {
  return u.isAdmin || u.company === empresaDoRegisto;
}
