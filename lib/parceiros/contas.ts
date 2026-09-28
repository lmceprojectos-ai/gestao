// Contas correntes (uma por parceiro) e passagem dos dados antigos (só Reclamarte).
import { prisma } from '@/lib/db';
import { enrich } from '@/lib/parceiros/calc';
import { getAllDTO } from '@/lib/parceiros/server-tx';

// Antes havia uma só conta (Criaconsensos ↔ Reclamarte): os registos sem parceiro
// e os utilizadores com a empresa antiga passam para o parceiro "Reclamarte".
// Não faz nada se já não houver nada para passar.
export async function migrarContaAntiga() {
  const [semConta, utilizadores] = await Promise.all([
    prisma.parceiroTransacao.count({ where: { parceiroId: null } }),
    prisma.user.findMany({ where: { parceiroEmpresa: { not: null }, parceiroId: null }, select: { id: true, parceiroEmpresa: true } }),
  ]);
  if (!semConta && !utilizadores.some((u) => u.parceiroEmpresa === 'RECLAMARTE')) return;
  let recl = await prisma.parceiro.findFirst({ where: { nome: 'Reclamarte' } });
  if (!recl) recl = await prisma.parceiro.create({ data: { nome: 'Reclamarte', emailAvisos: 'comercial@reclamarte.pt' } });
  await prisma.parceiroTransacao.updateMany({ where: { parceiroId: null }, data: { parceiroId: recl.id } });
  await prisma.parceiroTransacao.updateMany({ where: { company: 'RECLAMARTE' }, data: { company: 'PARCEIRO' } });
  await prisma.user.updateMany({ where: { parceiroEmpresa: 'RECLAMARTE', parceiroId: null }, data: { parceiroId: recl.id } });
}

export async function listarContas() {
  const parceiros = await prisma.parceiro.findMany({ orderBy: { nome: 'asc' }, include: { _count: { select: { transacoes: true, utilizadores: true } } } });
  return Promise.all(
    parceiros.map(async (p) => ({
      id: p.id,
      nome: p.nome,
      emailAvisos: p.emailAvisos,
      ativo: p.ativo,
      registos: p._count.transacoes,
      utilizadores: p._count.utilizadores,
      totals: enrich(await getAllDTO(p.id)).totals,
    })),
  );
}
