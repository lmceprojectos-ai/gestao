'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/format';

type LinhaMes = { data: string; valor: number };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Faturação vs custos (despesas + faturado por fornecedores), mês a mês desde janeiro.
export default function MensalChart({
  faturacao,
  despesas,
  fornecedores,
  ocultar,
}: {
  faturacao: LinhaMes[];
  despesas: LinhaMes[];
  fornecedores: LinhaMes[];
  ocultar?: boolean;
}) {
  const hoje = new Date();
  const meses = Array.from({ length: hoje.getMonth() + 1 }, (_, m) => ({
    mes: MESES[m],
    Faturação: 0,
    Despesas: 0,
    Fornecedores: 0,
  }));
  const somar = (lista: LinhaMes[], campo: 'Faturação' | 'Despesas' | 'Fornecedores') => {
    for (const l of lista ?? []) {
      const d = new Date(l.data);
      if (d.getFullYear() !== hoje.getFullYear() || !meses[d.getMonth()]) continue;
      meses[d.getMonth()][campo] += l.valor || 0;
    }
  };
  somar(faturacao, 'Faturação');
  somar(despesas, 'Despesas');
  somar(fornecedores, 'Fornecedores');

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={meses} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.15} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={40}
          tickFormatter={(v: number) => (ocultar ? '' : `${Math.round(v / 1000)}k`)}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number, nome: string) => [ocultar ? '••••••' : formatCurrency(value), nome]}
        />
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Faturação" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Despesas" stackId="custos" fill="#f59e0b" />
        <Bar dataKey="Fornecedores" stackId="custos" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
