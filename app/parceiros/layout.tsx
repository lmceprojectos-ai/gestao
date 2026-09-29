import { ReactNode } from 'react';
import { TemaParceiros } from '@/components/parceiros/tema';
import { metadataApp } from '@/lib/app-icone';

export const metadata = metadataApp('parceiros', 'Parceiros');

// Área Parceiros (conta corrente com a Reclamarte): tema próprio da app original
// (azul escuro, sempre claro), só nestas páginas — como o módulo de Ponto.
export default function ParceirosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="parceiros-theme min-h-screen bg-background text-foreground">
      <TemaParceiros />
      {children}
    </div>
  );
}
