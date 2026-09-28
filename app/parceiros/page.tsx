import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { utilizadorParceiros } from '@/lib/parceiros/acesso';
import { getAllDTO } from '@/lib/parceiros/server-tx';
import { enrich } from '@/lib/parceiros/calc';
import { LedgerDashboard } from '@/components/parceiros/ledger-dashboard';
import { ImportarInicial } from '@/components/parceiros/importar-inicial';

export const dynamic = 'force-dynamic';

export default async function ParceirosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login?callbackUrl=/parceiros');
  const user = await utilizadorParceiros();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold">Sem acesso aos Parceiros</p>
          <p className="text-sm text-muted-foreground">Peça a um administrador para lhe dar acesso em Gestão → Utilizadores.</p>
        </div>
      </div>
    );
  }
  const dto = await getAllDTO();
  const { rows, totals } = enrich(dto);
  return (
    <>
      {user.isAdmin && rows.length === 0 ? <ImportarInicial /> : null}
      <LedgerDashboard initialRows={rows} initialTotals={totals} user={user} />
    </>
  );
}
