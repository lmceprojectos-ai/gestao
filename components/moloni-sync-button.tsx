'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Botão para ir buscar dados ao Moloni (usado nos dashboards de Clientes e
// Fornecedores): faz o mesmo que os botões da página Moloni, só para um tipo.
//   clientes     → importa/atualiza os clientes
//   fornecedores → importa/atualiza os fornecedores
//   faturas | recibos | notas → atualiza os clientes e importa esses documentos
//   fornecedor-faturas | fornecedor-recibos | fornecedor-notas → atualiza os
//     fornecedores e importa esses documentos de fornecedor (Compras no Moloni)
export type AlvoMoloni = 'clientes' | 'fornecedores' | 'faturas' | 'recibos' | 'notas'
  | 'fornecedor-faturas' | 'fornecedor-recibos' | 'fornecedor-notas';

const NOMES: Record<AlvoMoloni, string> = {
  clientes: 'clientes',
  fornecedores: 'fornecedores',
  faturas: 'faturas',
  recibos: 'recibos',
  notas: 'notas de crédito/débito',
  'fornecedor-faturas': 'faturas de fornecedores',
  'fornecedor-recibos': 'recibos de fornecedores',
  'fornecedor-notas': 'notas de crédito/débito de fornecedores',
};

export function MoloniSyncButton({ alvo, label = 'Sincronizar Moloni', onDone }: { alvo: AlvoMoloni; label?: string; onDone?: () => void }) {
  const [aSincronizar, setASincronizar] = useState(false);

  const sincronizar = async () => {
    setASincronizar(true);
    const id = toast.loading(`A sincronizar ${NOMES[alvo]} com o Moloni...`);
    try {
      const doFornecedor = alvo.startsWith('fornecedor-');
      const body = alvo === 'clientes' || alvo === 'fornecedores'
        ? { type: alvo }
        : doFornecedor
          ? { type: 'documentosFornecedor', grupo: alvo.replace('fornecedor-', ''), incluirFornecedores: true }
          : { type: 'faturas', grupo: alvo, incluirClientes: true };
      const res = await fetch('/api/moloni/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.results) {
        toast.error(data?.error || 'Erro na sincronização com o Moloni', { id });
        return;
      }
      const r = alvo === 'clientes' || alvo === 'fornecedores' ? data.results[alvo]
        : doFornecedor ? data.results.documentosFornecedor : data.results.faturas;
      const c = data.results.conciliacao;
      const erros: string[] = [...(r?.errors ?? []), ...(c?.erros ?? [])];
      const resumo = `${r?.imported ?? 0} novo(s), ${r?.updated ?? 0} atualizado(s)${r?.linked ? `, ${r.linked} já existente(s) ligado(s)` : ''}`;
      const conciliacao = c
        ? `. Conciliados com as faturas: ${c.conciliados}${c.faturasLiquidadas ? ` (${c.faturasLiquidadas} fatura(s) liquidada(s))` : ''}${c.semFatura ? `, ${c.semFatura} sem a fatura na app` : ''}${c.porProcessar ? `. Faltam ${c.porProcessar}: carregue outra vez` : ''}`
        : '';
      if (erros.length) toast.warning(`Moloni: ${resumo}${conciliacao}. ${erros.length} erro(s): ${erros[0]}`, { id, duration: 12000 });
      else toast.success(`Moloni sincronizado: ${resumo}${conciliacao}`, { id, duration: c ? 10000 : 4000 });
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erro na sincronização com o Moloni', { id });
    } finally {
      setASincronizar(false);
    }
  };

  return (
    <button
      onClick={sincronizar}
      disabled={aSincronizar}
      className="flex items-center gap-2 px-4 py-2.5 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-60"
      title={`Ir ao Moloni buscar ${NOMES[alvo]}`}
    >
      <RefreshCw className={`h-4 w-4 ${aSincronizar ? 'animate-spin' : ''}`} />
      {aSincronizar ? 'A sincronizar...' : label}
    </button>
  );
}
