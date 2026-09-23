'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line, ComposedChart } from 'recharts';

const mesesPT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

export default function FluxoCaixaChart({ data }: { data: any[] }) {
  if ((data?.length ?? 0) === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados para o período selecionado</div>;
  }

  const chartData = (data ?? []).map((d: any) => {
    const parts = (d?.mes ?? '').split('-');
    const mesLabel = mesesPT[parts?.[1] ?? ''] ?? parts?.[1] ?? '';
    return {
      mes: `${mesLabel} ${parts?.[0]?.slice?.(2) ?? ''}`,
      recebimentos: d?.recebimentos ?? 0,
      pagamentos: d?.pagamentos ?? 0,
      saldo: d?.saldo ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
        <XAxis dataKey="mes" tickLine={false} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000)?.toFixed?.(0) ?? '0'}k`} />
        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number, name: string) => [`€${value?.toFixed?.(2) ?? '0.00'}`, name === 'recebimentos' ? 'Recebimentos' : name === 'pagamentos' ? 'Pagamentos' : 'Saldo']} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="recebimentos" name="Recebimentos" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pagamentos" name="Pagamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
