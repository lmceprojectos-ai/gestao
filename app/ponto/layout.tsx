import { ReactNode } from "react";

// Aplica o tema próprio (amarelo original) do módulo Gestão de Ponto,
// com escopo apenas às páginas /ponto — sem afetar o resto da aplicação.
export default function PontoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ponto-theme min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
