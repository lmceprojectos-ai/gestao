'use client';

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const MESES: Record<string, string> = { '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez' };

interface Props {
  data: { mes: string; despesas: number; faturacao: number; margem: number }[];
}

export default function DespesasVsFaturacaoChart({ data }: Props) {
  if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>;

  const formatted = data.map(d => {
    const [year, month] = d.mes.split('-');
    return {
      ...d,
      label: `${MESES[month] || month} ${year.slice(2)}`,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <Tooltip
          formatter={(value: number, name: string) => [
            `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`,
            name === 'despesas' ? 'Despesas' : name === 'faturacao' ? 'Faturação' : 'Margem',
          ]}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{ borderRadius: '0.5rem', fontSize: '0.85rem' }}
        />
        <Legend formatter={(value: string) => value === 'despesas' ? 'Despesas' : value === 'faturacao' ? 'Faturação' : 'Margem'} />
        <Bar dataKey="despesas" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} />
        <Bar dataKey="faturacao" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
        <Line type="monotone" dataKey="margem" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
