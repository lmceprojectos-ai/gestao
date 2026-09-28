'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Conta corrente aberta (empresa B): id do parceiro e nome, usados nos textos
// ("X deve à Criaconsensos") e nos pedidos à API (?conta=).
type Conta = { id: string; nome: string };
const ContaCtx = createContext<Conta>({ id: '', nome: 'Parceiro' });

export function ContaProvider({ conta, children }: { conta: Conta; children: ReactNode }) {
  return <ContaCtx.Provider value={conta}>{children}</ContaCtx.Provider>;
}

export function useConta() {
  return useContext(ContaCtx);
}
