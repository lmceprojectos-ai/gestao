'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, DatabaseBackup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConta } from '@/components/parceiros/conta';

// Aparece só ao administrador na conta da Reclamarte sem registos: traz os 32
// registos da app CONTA_CORRENTE (Abacus).
export function ImportarInicial() {
  const [aImportar, setAImportar] = useState(false);
  const router = useRouter();
  const conta = useConta();
  const importar = async () => {
    setAImportar(true);
    try {
      const r = await fetch(`/api/parceiros/importar?conta=${conta.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Erro ao importar');
      toast.success(`${d.criados} registos importados`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar');
    } finally {
      setAImportar(false);
    }
  };
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-6">
      <div className="rounded-xl border border-accent bg-accent/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm flex items-center gap-2"><DatabaseBackup className="h-4 w-4 shrink-0" />Ainda não há registos. Importar os dados da app Conta Corrente (Abacus)?</p>
        <Button onClick={importar} disabled={aImportar} className="gap-1.5 shrink-0">
          {aImportar ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Importar dados
        </Button>
      </div>
    </div>
  );
}
