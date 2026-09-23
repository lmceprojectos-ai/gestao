'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function FluxoChart({ recebimentos, pagamentos }: { recebimentos: any[]; pagamentos: any[] }) {
  const dailyData: Record<string, { dia: string; recebimentos: number; pagamentos: number }> = {};

  (recebimentos ?? []).forEach((r: any) => {
    const d = new Date(r?.dataRecebimento);
    const key = `${d.getUTCDate()}`;
    if (!dailyData[key]) dailyData[key] = { dia: key, recebimentos: 0, pagamentos: 0 };
    dailyData[key].recebimentos += r?.valor ?? 0;
  });

  (pagamentos ?? []).forEach((p: any) => {
    const d = new Date(p?.dataPagamento);
    const key = `${d.getUTCDate()}`;
    if (!dailyData[key]) dailyData[key] = { dia: key, recebimentos: 0, pagamentos: 0 };
    dailyData[key].pagamentos += p?.valor ?? 0;
  });

  const data = Object.values(dailyData ?? {}).sort((a: any, b: any) => parseInt(a?.dia) - parseInt(b?.dia));

  if ((data?.length ?? 0) === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados para o mês atual</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
        <XAxis dataKey="dia" tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Dia', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }} />
        <YAxis tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000)?.toFixed?.(0) ?? '0'}k`} />
        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [`€${value?.toFixed?.(2) ?? '0.00'}`, '']} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="recebimentos" name="Recebimentos" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pagamentos" name="Pagamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
