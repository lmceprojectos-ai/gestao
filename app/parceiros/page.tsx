import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { utilizadorParceiros, linkParceiro } from '@/lib/parceiros/acesso';
import { prisma } from '@/lib/db';
import { migrarContaAntiga, listarContas } from '@/lib/parceiros/contas';
import { ListaParceiros } from '@/components/parceiros/lista-parceiros';
import { AppHeader } from '@/components/parceiros/app-header';
import { SemAcesso } from '@/components/parceiros/sem-acesso';

export const dynamic = 'force-dynamic';

// Parceiros: a Criaconsensos (administradores) vê a lista de todas as contas
// correntes; um parceiro vai direto para a sua.
export default async function ParceirosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login?callbackUrl=/parceiros');
  const user = await utilizadorParceiros();
  if (!user) return <SemAcesso />;
  if (!user.isAdmin) {
    const todos = await prisma.parceiro.findMany({ select: { id: true, nome: true } });
    const meu = todos.find((p) => p.id === user.parceiroId);
    redirect(meu ? linkParceiro(meu, todos) : `/parceiros/${user.parceiroId}`);
  }
  await migrarContaAntiga();
  const contas = await listarContas();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <ListaParceiros contas={contas} />
    </div>
  );
}
