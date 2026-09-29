import { ReactNode } from 'react';
import { metadataApp } from '@/lib/app-icone';

export const metadata = metadataApp('redes-sociais', 'Redes Sociais');

export default function RedesSociaisLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
