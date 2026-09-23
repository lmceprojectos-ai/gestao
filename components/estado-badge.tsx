'use client';

import { cn } from '@/lib/utils';

const estadoStyles: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  pago: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
  parcial: 'bg-blue-100 text-blue-800',
};

const estadoLabels: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  parcial: 'Parcial',
};

export function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  const s = estado ?? 'pendente';
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', estadoStyles[s] ?? 'bg-gray-100 text-gray-800')}>
      {estadoLabels[s] ?? s}
    </span>
  );
}
