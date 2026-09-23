'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeft,
  FileText,
  Euro,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency } from '@/lib/format';
import { tipoOrcamentoInfo } from '@/lib/grafica/numero';

const PRODUTOS: Record<string, string> = {
  cartoes: 'Cartões Comerciais',
  stickers: 'Stickers / Adesivos',
  contratar: 'Contratar (Subcontratação)',
  imp_peq_formato: 'Flyers',
  vinil: 'Impressão digital de grande formato',
};

const ESTADOS: Record<string, { label: string; bar: string; text: string; badge: string }> = {
  rascunho: { label: 'Rascunho', bar: 'bg-slate-400', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' },
  pendente: { label: 'Pendente', bar: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  em_analise: { label: 'Em Análise', bar: 'bg-blue-400', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  adjudicado: { label: 'Adjudicado', bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  producao: { label: 'Em Produção', bar: 'bg-sky-500', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-800' },
  finalizado: { label: 'Finalizado', bar: 'bg-indigo-500', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
  recusado: { label: 'Recusado', bar: 'bg-red-400', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
};

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

export default function DashboardOrcamentosPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (ano) params.set('ano', ano);
    fetch(`/api/grafica/orcamentos/dashboard?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ano]);

  const totais = data?.totais || { count: 0, semIva: 0, custo: 0, margem: 0, ivaCount: 0, ivaSemIva: 0, ivaComIva: 0, onfCount: 0, onfSemIva: 0 };
  const receb = data?.recebimento || {};
  const porTipo: any[] = data?.porTipo || [];
  const porEstado: any[] = data?.porEstado || [];
  const porProduto: any[] = data?.porProduto || [];
  const anos: number[] = data?.anosDisponiveis || [];

  const maxTipo = Math.max(1, ...porTipo.map((t) => t.semIva));
  const maxEstado = Math.max(1, ...porEstado.map((e) => e.semIva));
  const maxProduto = Math.max(1, ...porProduto.map((p) => p.semIva));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard de Orçamentos"
        description="Totais, repartição por tipo de orçamento e estado de recebimento"
        action={
          <div className="flex items-center gap-2">
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="">Todos os anos</option>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <Link
              href="/orcamentos-graficos"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-sky-600" /><span className="text-sm text-muted-foreground">Nº de orçamentos</span></div>
              <p className="text-2xl font-bold">{totais.count}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <div className="flex items-center gap-2 mb-2"><Euro className="h-4 w-4 text-emerald-600" /><span className="text-sm text-muted-foreground">Valor total s/IVA</span></div>
              <p className="text-2xl font-bold font-mono text-emerald-700">{formatCurrency(totais.semIva)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <div className="flex items-center gap-2 mb-2"><Euro className="h-4 w-4 text-primary" /><span className="text-sm text-muted-foreground">Valor c/IVA (OC/OL)</span></div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totais.ivaComIva)}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">só orçamentos com IVA · exclui ONF</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-violet-600" /><span className="text-sm text-muted-foreground">Margem global</span></div>
              <p className="text-2xl font-bold font-mono text-violet-700">{pct(totais.margem)}</p>
            </motion.div>
          </div>

          {/* ONF — isentos de IVA, contabilizados à parte */}
          {(totais.onfCount || 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-slate-50 rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-800">Orçamentos ONF (isentos de IVA)</span>
                  </div>
                  <p className="text-[12px] text-slate-600">Não faturados / controlo interno. O valor não é somado ao total c/IVA.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-mono text-slate-800">{formatCurrency(totais.onfSemIva)}</p>
                  <p className="text-[12px] text-slate-600">{totais.onfCount} orçamento(s) · isento de IVA</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Estado de recebimento */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
            <h2 className="text-lg font-semibold mb-1">Estado de recebimento</h2>
            <p className="text-sm text-muted-foreground mb-4">Valor adjudicado (a receber), pendente de decisão e recusado.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-sm text-emerald-800">Adjudicado (a receber)</span></div>
                <p className="text-xl font-bold font-mono text-emerald-700">{formatCurrency(receb.adjudicadoSemIva)}</p>
                <p className="text-[12px] text-emerald-700/70 mt-0.5">{receb.adjudicadoCount || 0} orçamento(s){(receb.adjudicadoComIvaTributavel || 0) > 0 ? ` · ${formatCurrency(receb.adjudicadoComIvaTributavel)} c/IVA (OC/OL)` : ''}</p>
              </div>
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-600" /><span className="text-sm text-amber-800">Pendente</span></div>
                <p className="text-xl font-bold font-mono text-amber-700">{formatCurrency(receb.pendenteSemIva)}</p>
                <p className="text-[12px] text-amber-700/70 mt-0.5">{receb.pendenteCount || 0} orçamento(s)</p>
              </div>
              <div className="rounded-xl p-4 bg-red-50 border border-red-100">
                <div className="flex items-center gap-2 mb-1"><XCircle className="h-4 w-4 text-red-600" /><span className="text-sm text-red-800">Recusado</span></div>
                <p className="text-xl font-bold font-mono text-red-700">{formatCurrency(receb.recusadoSemIva)}</p>
                <p className="text-[12px] text-red-700/70 mt-0.5">{receb.recusadoCount || 0} orçamento(s)</p>
              </div>
              <div className="rounded-xl p-4 bg-violet-50 border border-violet-100">
                <div className="flex items-center gap-2 mb-1"><Percent className="h-4 w-4 text-violet-600" /><span className="text-sm text-violet-800">Taxa de adjudicação</span></div>
                <p className="text-xl font-bold font-mono text-violet-700">{pct(receb.taxaAdjudicacao)}</p>
                <p className="text-[12px] text-violet-700/70 mt-0.5">sobre orçamentos decididos</p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por tipo de orçamento */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <h2 className="text-lg font-semibold mb-4">Por tipo de orçamento</h2>
              {porTipo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="space-y-4">
                  {porTipo.map((t) => {
                    const info = tipoOrcamentoInfo(t.tipo);
                    return (
                      <div key={t.tipo}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{t.tipo} · <span className="text-muted-foreground font-normal">{info.label.replace(/\s*\(.*\)/, '')}</span></span>
                          <span className="font-mono font-semibold text-emerald-700">{formatCurrency(t.semIva)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(t.semIva / maxTipo) * 100}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground mt-1">
                          <span>{t.count} orçamento(s)</span>
                          <span>{t.temIva ? `${formatCurrency(t.comIva)} c/IVA` : 'isento de IVA'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Por estado */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
              <h2 className="text-lg font-semibold mb-4">Por estado</h2>
              {porEstado.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="space-y-4">
                  {porEstado.map((e) => {
                    const info = ESTADOS[e.estado] || ESTADOS.pendente;
                    return (
                      <div key={e.estado}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.badge}`}>{info.label}</span>
                          <span className="font-mono font-semibold">{formatCurrency(e.semIva)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${info.bar}`} style={{ width: `${(e.semIva / maxEstado) * 100}%` }} />
                        </div>
                        <div className="text-[12px] text-muted-foreground mt-1">{e.count} orçamento(s)</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Por produto */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
            <h2 className="text-lg font-semibold mb-4">Por produto</h2>
            {porProduto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-4">
                {porProduto.map((p) => (
                  <div key={p.produto}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{PRODUTOS[p.produto] || p.produto}</span>
                      <span className="font-mono font-semibold text-emerald-700">{formatCurrency(p.semIva)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(p.semIva / maxProduto) * 100}%` }} />
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-1">{p.count} orçamento(s)</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
