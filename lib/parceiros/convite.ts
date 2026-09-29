// Link de convite de cada parceiro: leva à página de entrada da empresa, onde
// se entra, se cria conta (perfil "Parceiro", só a conta corrente desse parceiro)
// ou se repõe a palavra-passe. O código do link é assinado com o segredo da app,
// por isso não se consegue adivinhar nem trocar de parceiro.
import crypto from 'crypto';
import { slugParceiro } from '@/lib/parceiros/acesso';

export function codigoConvite(parceiroId: string) {
  const segredo = process.env.NEXTAUTH_SECRET || 'parceiros';
  return crypto.createHmac('sha256', segredo).update(`parceiro-convite:${parceiroId}`).digest('base64url').slice(0, 22);
}

export function conviteValido(parceiroId: string, codigo: string | null | undefined) {
  if (!codigo) return false;
  const a = Buffer.from(codigoConvite(parceiroId));
  const b = Buffer.from(String(codigo));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function linkConvite(p: { id: string; nome: string }) {
  const base = (process.env.NEXTAUTH_URL || 'https://app.kh4.pt').replace(/\/+$/, '');
  return `${base}/convite/${slugParceiro(p.nome)}?c=${codigoConvite(p.id)}`;
}
