import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { utilizadorParceiros, contaDoPedido } from '@/lib/parceiros/acesso';
import { getAllDTO } from '@/lib/parceiros/server-tx';
import { enrich } from '@/lib/parceiros/calc';
import { LedgerDashboard } from '@/components/parceiros/ledger-dashboard';
import { ImportarInicial } from '@/components/parceiros/importar-inicial';
import { ContaProvider } from '@/components/parceiros/conta';
import { SemAcesso } from '@/components/parceiros/sem-acesso';

export const dynamic = 'force-dynamic';

// Conta corrente Criaconsensos ↔ um parceiro.
export default async function ContaParceiroPage({ params }: { params: { parceiroId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/parceiros/${params.parceiroId}`);
  const user = await utilizadorParceiros();
  if (!user) return <SemAcesso />;
  const conta = await contaDoPedido(user, params.parceiroId);
  // Um parceiro que tente abrir outra conta volta para a sua.
  if (!conta) redirect('/parceiros');
  const { rows, totals } = enrich(await getAllDTO(conta.id));
  return (
    <ContaProvider conta={{ id: conta.id, nome: conta.nome }}>
      {user.isAdmin && rows.length === 0 && conta.nome.toLowerCase() === 'reclamarte' ? <ImportarInicial /> : null}
      <LedgerDashboard initialRows={rows} initialTotals={totals} user={user} />
    </ContaProvider>
  );
}
