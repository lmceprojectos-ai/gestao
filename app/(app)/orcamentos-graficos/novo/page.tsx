'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { OrcamentoForm } from '../_components/orcamento-form';

function NovoInner() {
  const params = useSearchParams();
  const id = params?.get('id') || undefined;
  const duplicar = params?.get('duplicar') || undefined;
  return (
    <div>
      <PageHeader
        title={id ? 'Editar Orçamento' : duplicar ? 'Duplicar Orçamento' : 'Novo Orçamento Gráfico'}
        description="Configure o trabalho e veja o cálculo de custos e preços em tempo real"
        icon={Printer}
        action={
          <Link href="/orcamentos-graficos" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />
      <OrcamentoForm orcamentoId={id} duplicarId={duplicar} />
    </div>
  );
}

export default function NovoOrcamentoPage() {
  return (
    <Suspense fallback={null}>
      <NovoInner />
    </Suspense>
  );
}
