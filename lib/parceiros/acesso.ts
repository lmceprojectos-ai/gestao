// Quem entra nos Parceiros (contas correntes: empresa A = Criaconsensos, B = cada parceiro):
//  - administradores da Gestão: são a Criaconsensos, veem todas as contas e alteram tudo;
//  - utilizadores ligados a um parceiro: só veem a conta desse parceiro e só alteram
//    os registos do parceiro.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import type { Company } from '@/lib/parceiros/calc';
import { hasGestaoAccess } from '@/lib/ponto/roles';

export type UtilizadorParceiros = {
  id: string;
  name: string;
  email: string;
  company: Company;
  isAdmin: boolean;
  temGestao: boolean;
  parceiroId: string | null;
};

export async function utilizadorParceiros(): Promise<UtilizadorParceiros | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, parceiroId: true } });
  if (!u) return null;
  const isAdmin = u.role === 'admin';
  if (!isAdmin && !u.parceiroId) return null;
  return {
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    company: isAdmin ? 'CRIACONSENSOS' : 'PARCEIRO',
    isAdmin,
    temGestao: hasGestaoAccess(u.role),
    parceiroId: isAdmin ? null : u.parceiroId,
  };
}

// Pode ver a conta deste parceiro?
export function acessoConta(u: UtilizadorParceiros, parceiroId: string | null | undefined) {
  if (!parceiroId) return false;
  return u.isAdmin || u.parceiroId === parceiroId;
}

// Pode alterar este registo: administrador, ou o parceiro dono do registo na sua conta.
export function podeAlterar(u: UtilizadorParceiros, reg: { company: string; parceiroId: string | null }) {
  if (u.isAdmin) return true;
  return reg.company === 'PARCEIRO' && !!reg.parceiroId && reg.parceiroId === u.parceiroId;
}

// Parceiro da conta pedida (?conta=), já com a verificação de acesso.
export async function contaDoPedido(u: UtilizadorParceiros, contaId: string | null) {
  const id = contaId || u.parceiroId;
  if (!id || !acessoConta(u, id)) return null;
  return prisma.parceiro.findUnique({ where: { id } });
}
