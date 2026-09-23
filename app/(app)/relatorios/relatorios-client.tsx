'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Landmark, ShoppingCart, FileText } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency } from '@/lib/format';
import dynamic from 'next/dynamic';

const FluxoCaixaChart = dynamic(() => import('./fluxo-caixa-chart'), { ssr: false, loading: () => <div className="h-80 bg-muted rounded-xl animate-pulse" /> });
const DespesasVsFaturacaoChart = dynamic(() => import('./despesas-vs-faturacao-chart'), { ssr: false, loading: () => <div className="h-80 bg-muted rounded-xl animate-pulse" /> });

const CATEGORIAS: Record<string, string> = { material: 'Material', servicos: 'Serviços', renda: 'Renda', comunicacoes: 'Comunicações', transportes: 'Transportes', seguros: 'Seguros', manutencao: 'Manutenção', marketing: 'Marketing', outro: 'Outro' };

export function RelatoriosClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('6');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/relatorios?periodo=${periodo}`)
      .then((r) => r.json())
      .then((d: any) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [periodo]);

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  const saldo = (data?.totalRecebimentos ?? 0) - (data?.totalPagamentos ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Relatórios" description="Análise financeira e fluxo de caixa" action={
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="px-3 py-2 border border-input rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </select>
      } />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-emerald-600" /><span className="text-sm text-gray-600 dark:text-gray-400">Total Recebimentos</span></div>
          <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatCurrency(data?.totalRecebimentos)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-red-600" /><span className="text-sm text-gray-600 dark:text-gray-400">Total Pagamentos</span></div>
          <p className="text-2xl font-bold font-mono text-red-700 dark:text-red-400">{formatCurrency(data?.totalPagamentos)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Landmark className="h-4 w-4 text-primary" /><span className="text-sm text-gray-600 dark:text-gray-400">Saldo Período</span></div>
          <p className={`text-2xl font-bold font-mono ${saldo >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{formatCurrency(saldo)}</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Fluxo de Caixa Mensal</h2>
        <div className="h-80">
          <FluxoCaixaChart data={data?.fluxoCaixa ?? []} />
        </div>
      </motion.div>

      {/* Despesas vs Faturação */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-orange-600" />Despesas Mensais vs Faturação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-xs text-muted-foreground">Total Despesas</p>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{formatCurrency(data?.totalDespesas ?? 0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-muted-foreground">Total Faturação</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(data?.totalFaturacao ?? 0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-muted-foreground">Margem</p>
            <p className={`text-lg font-bold ${(data?.totalFaturacao ?? 0) - (data?.totalDespesas ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{formatCurrency((data?.totalFaturacao ?? 0) - (data?.totalDespesas ?? 0))}</p>
          </div>
        </div>
        <div className="h-80"><DespesasVsFaturacaoChart data={data?.comparativoMensal ?? []} /></div>
      </motion.div>

      {/* Despesas por Categoria */}
      {data?.despesasPorCategoria && Object.keys(data.despesasPorCategoria).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-purple-600" />Despesas por Categoria</h2>
          <div className="space-y-2">
            {Object.entries(data.despesasPorCategoria as Record<string, number>).sort(([,a],[,b]) => b - a).map(([cat, val]) => {
              const total = data.totalDespesas || 1;
              const pct = ((val as number) / total * 100).toFixed(1);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-sm w-28 font-medium">{CATEGORIAS[cat] || cat}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                  <span className="text-sm font-mono w-24 text-right">{formatCurrency(val as number)}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Saldos das contas */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Saldos Atuais das Contas</h2>
        <div className="space-y-3">
          {(data?.contas ?? []).map((conta: any) => (
            <div key={conta?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div><p className="font-medium text-sm">{conta?.nome}</p><p className="text-xs text-muted-foreground">{conta?.banco}</p></div>
              <p className="text-lg font-bold font-mono">{formatCurrency(conta?.saldoAtual)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
            <p className="font-semibold">Saldo Total</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(data?.saldoContas)}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
