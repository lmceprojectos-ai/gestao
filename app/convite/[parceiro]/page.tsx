import { prisma } from '@/lib/db';
import { slugParceiro } from '@/lib/parceiros/acesso';
import { conviteValido } from '@/lib/parceiros/convite';
import { EntradaParceiro } from '@/components/parceiros/entrada-parceiro';
import { TemaParceiros } from '@/components/parceiros/tema';

export const dynamic = 'force-dynamic';

// Página pública do link de convite de um parceiro: entrar, criar conta ou repor
// a palavra-passe, e seguir para a conta corrente da empresa.
export default async function ConvitePage({ params, searchParams }: { params: { parceiro: string }; searchParams: { c?: string; email?: string } }) {
  const parceiro = (await prisma.parceiro.findMany({ where: { ativo: true } })).find((p) => slugParceiro(p.nome) === params.parceiro);
  const valido = !!parceiro && conviteValido(parceiro.id, searchParams.c);
  return (
    <div className="parceiros-theme min-h-screen bg-background text-foreground">
      <TemaParceiros />
      {valido ? (
        <EntradaParceiro nome={parceiro!.nome} slug={params.parceiro} codigo={searchParams.c!} emailInicial={searchParams.email} />
      ) : (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="space-y-2">
            <p className="text-lg font-semibold">Link inválido</p>
            <p className="text-sm text-muted-foreground">Este link de acesso não é válido ou já não está ativo. Peça um novo link à Criaconsensos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
