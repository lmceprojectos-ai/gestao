'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

// Gráficos do dashboard do Balancete (mesmo aspeto do balancete2026).

const euro = (v: number) => `€${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CORES_CATEGORIAS = ['#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#6366f1'];

export function GraficoTrimestres({ dados }: { dados: { trimestre: string; receitas: number; despesas: number }[] }) {
  const linhas = dados.map((t) => ({ trimestre: t.trimestre, Receitas: t.receitas, Despesas: t.despesas }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={linhas} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="trimestre" tick={{ fontSize: 11 }} label={{ value: 'Trimestre', position: 'insideBottom', offset: -12, fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          label={{ value: 'Valor (€)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <Tooltip formatter={(v: number) => euro(v)} />
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Receitas" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoCategorias({ dados }: { dados: { nome: string; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => euro(v)} />
        <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="45%" outerRadius="70%" paddingAngle={1} stroke="#fff">
          {dados.map((_, i) => <Cell key={i} fill={CORES_CATEGORIAS[i % CORES_CATEGORIAS.length]} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
