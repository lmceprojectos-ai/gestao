import { ReactNode } from 'react';
import { TemaConexus } from '@/components/conexus/tema';
import { metadataApp } from '@/lib/app-icone';

export const metadata = metadataApp('conexus', 'Conexus');

// Conexus (agenda de assuntos/tarefas): tema próprio da app original, só nestas
// páginas — como o Ponto e os Parceiros. Só administradores (ver middleware).
export default function ConexusLayout({ children }: { children: ReactNode }) {
  return (
    <div className="conexus-theme min-h-screen bg-background text-foreground">
      <TemaConexus />
      {children}
    </div>
  );
}
