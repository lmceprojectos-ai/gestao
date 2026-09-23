'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  AlertTriangle,
  ShoppingCart,
  CalendarDays,
  FilePlus,
  ScanLine,
  Wallet,
  Receipt,
  CheckCircle2,
  Check,
  RotateCcw,
  X,
  Link2,
  Search,
  Eye,
  EyeOff,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { DateRangeFilter, dateInRange, rangeLabel, type DateRange } from '@/components/date-range-filter';
import { EstadoBadge } from '@/components/estado-badge';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import dynamic from 'next/dynamic';

const FluxoChart = dynamic(() => import('./fluxo-chart'), { ssr: false, loading: () => <div className="h-64 bg-muted rounded-xl animate-pulse" /> });

export function DashboardClient() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role || '';
  const isInsercao = role === 'insercao';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [okBusy, setOkBusy] = useState<string | null>(null);
  const [okModal, setOkModal] = useState<{ fornecedor: string; ano: number; mes: number; label: string; confirmacaoId?: string; seguros?: any[] } | null>(null);
  const [faturasDisp, setFaturasDisp] = useState<any[] | null>(null);
  const [faturasLoading, setFaturasLoading] = useState(false);
  const [faturaSearch, setFaturaSearch] = useState('');
  const [docPreview, setDocPreview] = useState<{ url: string; loading: boolean } | null>(null);
  const [movModal, setMovModal] = useState<{ tipo: 'faturacao' | 'despesas' | 'pagamentos'; titulo: string; itens: any[]; total: number } | null>(null);
  const [movRange, setMovRange] = useState<DateRange>({ inicio: '', fim: '' });
  const [hideValues, setHideValues] = useState(false);

  // Ocultar/mostrar valores monetários (privacidade quando há clientes na sala).
  useEffect(() => {
    try { if (localStorage.getItem('dashHideValues') === '1') setHideValues(true); } catch {}
  }, []);
  const toggleHideValues = () => setHideValues((prev) => {
    const nv = !prev;
    try { localStorage.setItem('dashHideValues', nv ? '1' : '0'); } catch {}
    return nv;
  });
  const mask = (s: string) => (hideValues ? '••••••' : s);

  // Movimentos filtrados pelo período escolhido no modal.
  const movItens: any[] = movModal ? (movModal.itens ?? []).filter((it: any) => dateInRange(it.data, movRange)) : [];
  const movTotal = movItens.reduce((a: number, it: any) => a + (Number(it.valor) || 0), 0);

  const abrirDocAuto = async (tipo: string, docId: string) => {
    setDocPreview({ url: '', loading: true });
    try {
      const endpoint = tipo === 'fatura' ? `/api/faturas/${docId}/url` : tipo === 'despesa' ? `/api/despesas/${docId}` : `/api/impostos/${docId}`;
      const res = await fetch(endpoint);
      const d = await res.json();
      const url = d?.url;
      if (!url) throw new Error();
      setDocPreview({ url, loading: false });
    } catch {
      setDocPreview(null);
      toast.error('Não foi possível abrir o documento');
    }
  };

  const imprimirMovModal = () => {
    if (!movModal) return;
    const linhas = movItens.map((it: any) => {
      const sub: string[] = [];
      if (it.entidade) sub.push(String(it.entidade));
      const desc = [it.label, sub.join(' · ')].filter(Boolean).join(' — ');
      return `<tr><td>${desc}</td><td style="text-align:right;white-space:nowrap">${formatCurrency(it.valor)}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${movModal.titulo}</title>`
      + `<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px}h1{font-size:18px;margin:0 0 4px}p.sub{color:#555;font-size:12px;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 6px;border-bottom:1px solid #ddd}th{text-align:left;background:#f5f5f5}tfoot td{font-weight:bold;border-top:2px solid #333;border-bottom:none}</style>`
      + `</head><body><h1>${movModal.titulo}</h1>`
      + `<p class="sub">CRIACONSENSOS · ${rangeLabel(movRange)} · ${movItens.length} ${movItens.length === 1 ? 'mês' : 'meses'}</p>`
      + `<table><thead><tr><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>`
      + `<tbody>${linhas}</tbody>`
      + `<tfoot><tr><td>Total</td><td style="text-align:right">${formatCurrency(movTotal)}</td></tr></tfoot></table>`
      + `</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Ative as janelas emergentes para imprimir'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const loadData = () => {
    return fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d: any) => setData(d))
      .catch(console.error);
  };

  useEffect(() => {
    if (isInsercao) { setLoading(false); return; }
    loadData().finally(() => setLoading(false));
  }, [isInsercao]);

  const abrirModalOk = (fornecedor: string, ano: number, mes: number, label: string, confirmacaoId?: string, seguros?: any[]) => {
    setFaturaSearch('');
    setOkModal({ fornecedor, ano, mes, label, confirmacaoId, seguros });
    // Validação de seguros: a lista já vem no próprio item — não é preciso
    // carregar faturas nem despesas.
    if (seguros) return;
    if (faturasDisp === null) {
      setFaturasLoading(true);
      fetch('/api/faturas')
        .then((r) => r.json())
        .then((d: any) => setFaturasDisp(Array.isArray(d) ? d : []))
        .catch(() => setFaturasDisp([]))
        .finally(() => setFaturasLoading(false));
    }
  };

  const confirmarFaturaFixaOk = async (fatura: any | null) => {
    if (!okModal) return;
    const { fornecedor, ano, mes, confirmacaoId } = okModal;
    const chave = confirmacaoId ?? `${ano}-${mes}-${fornecedor}`;
    setOkBusy(chave);
    try {
      const faturaNumero = fatura
        ? (fatura?.numero || fatura?.descricao || fatura?.fornecedor?.nome || 'Documento')
        : null;
      const res = await fetch('/api/faturas-fixas-ok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmacaoId ?? null, fornecedor, ano, mes, faturaId: fatura?.id ?? null, faturaNumero }),
      });
      if (!res.ok) throw new Error();
      toast.success(fatura ? `"${fornecedor}" associada à fatura ${faturaNumero}` : `"${fornecedor}" marcada como OK`);
      setOkModal(null);
      await loadData();
    } catch {
      toast.error('Não foi possível marcar como OK');
    } finally {
      setOkBusy(null);
    }
  };

  const anularFaturaFixaOk = async (confirmacaoId: string) => {
    setOkBusy(confirmacaoId);
    try {
      const params = new URLSearchParams({ id: confirmacaoId });
      const res = await fetch(`/api/faturas-fixas-ok?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Confirmação anulada');
      await loadData();
    } catch {
      toast.error('Não foi possível anular');
    } finally {
      setOkBusy(null);
    }
  };

  // Anula uma deteção AUTOMÁTICA errada (correspondência incorreta do documento
  // a um fornecedor fixo). O documento não é apagado — apenas deixa de ser
  // contabilizado como fatura fixa desse fornecedor.
  const ignorarAuto = async (it: any, ano: number, mes: number) => {
    if (!it?.tipo || !it?.docId) return;
    if (!confirm(`Anular a deteção automática de "${it.nome}"?\n\nO documento digitalizado NÃO é apagado — apenas deixa de contar como esta fatura fixa. A obrigação voltará a aparecer como "em falta" se não houver outro documento.`)) return;
    setOkBusy(it.id);
    try {
      const res = await fetch('/api/faturas-fixas-ignorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: it.tipo, docId: it.docId, fornecedor: it.nome, ano, mes }),
      });
      if (!res.ok) throw new Error();
      toast.success('Deteção automática anulada');
      await loadData();
    } catch {
      toast.error('Não foi possível anular');
    } finally {
      setOkBusy(null);
    }
  };

  // Vista simplificada para o perfil de Inserção (sem valores/totais)
  if (isInsercao) {
    const atalhos = [
      { href: '/faturas', label: 'Documentos', desc: 'Inserir e digitalizar faturas e notas', icon: FileText, cor: 'bg-blue-50 text-blue-700', iconCor: 'text-blue-600' },
      { href: '/pagamentos', label: 'Pagamentos', desc: 'Registar e digitalizar comprovativos', icon: Wallet, cor: 'bg-red-50 text-red-700', iconCor: 'text-red-600' },
      { href: '/recebimentos', label: 'Recebimentos', desc: 'Registar recebimentos', icon: ArrowDownCircle, cor: 'bg-emerald-50 text-emerald-700', iconCor: 'text-emerald-600' },
      { href: '/despesas', label: 'Despesas', desc: 'Inserir e digitalizar despesas', icon: Receipt, cor: 'bg-amber-50 text-amber-700', iconCor: 'text-amber-600' },
    ];
    return (
      <div className="space-y-6">
        <PageHeader icon={FilePlus} title="Inserção de Documentos" description="Escolha o que pretende inserir ou digitalizar" />
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-50"><ScanLine className="h-5 w-5 text-violet-600" /></div>
          <div>
            <p className="text-sm font-medium text-foreground">Perfil operativo</p>
            <p className="text-sm text-muted-foreground">Pode inserir e digitalizar documentos. Se precisar de corrigir ou apagar algo, contacte um administrador.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {atalhos.map((a, idx) => {
            const Icon = a.icon;
            return (
              <motion.div key={a.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
                <Link href={a.href} className="block bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-border">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${a.cor}`}><Icon className={`h-6 w-6 ${a.iconCor}`} /></div>
                    <div>
                      <p className="font-semibold text-foreground">{a.label}</p>
                      <p className="text-sm text-muted-foreground">{a.desc}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i: number) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const CATEGORIAS: Record<string, string> = { material: 'Material', servicos: 'Serviços', renda: 'Renda', comunicacoes: 'Comunicações', transportes: 'Transportes', seguros: 'Seguros', manutencao: 'Manutenção', marketing: 'Marketing', outro: 'Outro' };

  const cards = [
    { title: 'Saldo Total', value: formatCurrency(data?.saldoTotal), icon: Landmark, color: 'bg-blue-50 text-blue-700', iconColor: 'text-blue-600' },
    { title: 'Faturado (Mês)', value: formatCurrency(data?.totalFaturado), icon: FileText, color: 'bg-purple-50 text-purple-700', iconColor: 'text-purple-600' },
    { title: 'Total Recebido', value: formatCurrency(data?.valorRecebido), icon: TrendingUp, color: 'bg-emerald-50 text-emerald-700', iconColor: 'text-emerald-600' },
    { title: 'Total Pago', value: formatCurrency(data?.valorPago), icon: TrendingDown, color: 'bg-red-50 text-red-700', iconColor: 'text-red-600' },
    { title: 'Pendentes', value: `${data?.recebimentosPendentes ?? 0} rec. / ${data?.pagamentosPendentes ?? 0} pag.`, icon: Clock, color: 'bg-amber-50 text-amber-700', iconColor: 'text-amber-600' },
    { title: 'Faturas p/ Receber', value: formatCurrency((data?.totalFaturado ?? 0) - (data?.totalFaturadoPago ?? 0)), icon: AlertTriangle, color: 'bg-orange-50 text-orange-700', iconColor: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={LayoutDashboard} title="Dashboard" description="Visão geral da situação financeira da CRIACONSENSOS" />

      {/* Resultado acumulado em destaque (desde janeiro · Faturação − Despesas − Faturado por fornecedores) */}
      {(() => {
        const faturacao = data?.faturacaoAcumulada ?? 0;
        const despesas = data?.despesasAcumuladas ?? 0;
        const pagFornecedores = data?.fornecedoresFaturado ?? data?.pagFornecedoresAcumulados ?? 0;
        const resultado = data?.resultadoAcumulado ?? (faturacao - despesas - pagFornecedores);
        const positivo = resultado >= 0;
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 sm:p-8 shadow-sm border ${positivo ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground mb-1">Resultado desde janeiro até hoje · Faturação − Despesas − Faturado por fornecedores</p>
                <p className={`text-4xl sm:text-5xl font-bold font-display tracking-tight tabular-nums ${positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {hideValues ? '••••••' : `${positivo ? '+' : '-'} ${formatCurrency(Math.abs(resultado))}`}
                </p>
                <p className={`text-sm font-medium mt-1 ${positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {positivo ? 'Resultado positivo' : 'Resultado negativo'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={toggleHideValues}
                  title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                  aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-card/70 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
                >
                  {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="hidden sm:inline">{hideValues ? 'Mostrar valores' : 'Ocultar valores'}</span>
                </button>
                <div className={`p-4 rounded-2xl ${positivo ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                  {positivo
                    ? <TrendingUp className="h-9 w-9 sm:h-12 sm:w-12 text-emerald-600 dark:text-emerald-400" />
                    : <TrendingDown className="h-9 w-9 sm:h-12 sm:w-12 text-red-600 dark:text-red-400" />}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMovModal({ tipo: 'faturacao', titulo: 'Faturação desde janeiro', itens: data?.movimentosFaturacao ?? [], total: faturacao })}
                className="text-left rounded-xl bg-card/70 border border-border p-3 hover:border-purple-400 hover:shadow-sm transition group"
              >
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-purple-600" />Faturação (desde janeiro)</p>
                {/* por mês */}
                <p className="text-lg font-bold font-display text-foreground mt-0.5 tabular-nums">{mask(formatCurrency(faturacao))}</p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1 opacity-80 group-hover:opacity-100"><Eye className="h-3 w-3" />Ver por mês</p>
              </button>
              <button
                type="button"
                onClick={() => setMovModal({ tipo: 'despesas', titulo: 'Despesas desde janeiro', itens: data?.movimentosDespesas ?? [], total: despesas })}
                className="text-left rounded-xl bg-card/70 border border-border p-3 hover:border-red-400 hover:shadow-sm transition group"
              >
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-red-600" />Despesas (desde janeiro)</p>
                <p className="text-lg font-bold font-display text-foreground mt-0.5 tabular-nums">{mask(formatCurrency(despesas))}</p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1 opacity-80 group-hover:opacity-100"><Eye className="h-3 w-3" />Ver por mês</p>
              </button>
              <button
                type="button"
                onClick={() => setMovModal({ tipo: 'pagamentos', titulo: 'Faturado por fornecedores, por mês (desde janeiro)', itens: data?.movimentosPagamentosFornecedores ?? [], total: pagFornecedores })}
                className="text-left rounded-xl bg-card/70 border border-border p-3 hover:border-orange-400 hover:shadow-sm transition group"
              >
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5 text-orange-600" />Fornecedores — faturado (desde janeiro)</p>
                <p className="text-lg font-bold font-display text-foreground mt-0.5 tabular-nums">{mask(formatCurrency(pagFornecedores))}</p>
                <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5 flex items-center gap-1 opacity-80 group-hover:opacity-100"><Eye className="h-3 w-3" />Ver por mês</p>
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* Alerta de faturas fixas mensais em falta (de Abril até hoje) */}
      {data && (() => {
        const porMes: { ano: number; mes: number; label: string; fornecedores: { nome: string; esperado: number; contabilizadas: number; emFalta: number }[] }[] = data?.fornecedoresFixosEmFaltaPorMes ?? [];
        const confirmadosPorMes: { ano: number; mes: number; label: string; itens: { id: string; nome: string; faturaId: string | null; faturaNumero: string | null; esperado: number; contabilizadas: number; auto?: boolean; tipo?: string; docId?: string; temDoc?: boolean }[] }[] = data?.fornecedoresFixosConfirmadosPorMes ?? [];
        const total = porMes.reduce((a, m) => a + (m?.fornecedores ?? []).reduce((b, f) => b + (f?.emFalta ?? 0), 0), 0);
        const totalConfirmados = confirmadosPorMes.reduce((a, m) => a + (m?.itens?.length ?? 0), 0);

        const confirmadosBloco = totalConfirmados > 0 ? (
          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">Faturas fixas validadas (documento digitalizado) · {totalConfirmados}</p>
            <div className="space-y-2">
              {confirmadosPorMes.map((m) => (
                <div key={`ok-${m.ano}-${m.mes}`}>
                  <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80 mb-1 capitalize">{m.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {(m.itens ?? []).map((it: any) => (
                        <span key={it.id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />{it.nome}
                          {it.esperado > 1 && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">({it.contabilizadas}/{it.esperado})</span>}
                          {it.faturaNumero && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border-l border-emerald-300 dark:border-emerald-700 pl-1.5"><Link2 className="h-3 w-3" />{it.faturaNumero}</span>}
                          {it.auto ? (
                            <>
                              <span className="text-[10px] uppercase tracking-wide text-emerald-500 dark:text-emerald-500 border-l border-emerald-300 dark:border-emerald-700 pl-1.5">auto</span>
                              {it.temDoc && it.docId && (
                                <button onClick={() => abrirDocAuto(it.tipo, it.docId)} title="Ver documento digitalizado" className="ml-0.5 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                              <button onClick={() => ignorarAuto(it, m.ano, m.mes)} disabled={okBusy === it.id} title="Anular esta deteção automática (documento não é apagado)" className="p-0.5 rounded text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-50">
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              {!String(it.nome).startsWith('Seguros') && (
                                <button onClick={() => abrirModalOk(it.nome, m.ano, m.mes, m.label, it.id)} title="Alterar fatura associada" className="ml-0.5 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                                  <Link2 className="h-3 w-3" />
                                </button>
                              )}
                              <button onClick={() => anularFaturaFixaOk(it.id)} disabled={okBusy === it.id} title="Anular esta confirmação" className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50">
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;

        if (total === 0) {
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 shrink-0"><CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                <div className="min-w-0 w-full">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Faturas fixas em dia</p>
                  <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">Todas as faturas de despesas fixas mensais deram entrada (verificação desde abril até hoje).</p>
                  {confirmadosBloco}
                </div>
              </div>
            </motion.div>
          );
        }
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 border border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 shrink-0"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
              <div className="min-w-0 w-full">
                <p className="font-semibold text-amber-800 dark:text-amber-300">Faltam {total} fatura{total > 1 ? 's' : ''} de despesas fixas</p>
                <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-0.5 mb-3">Ainda não deu entrada uma fatura correspondente aos seguintes fornecedores (por mês, desde abril). Se a fatura já estiver digitalizada, use o botão <span className="font-semibold">✓</span> para a dar como OK.</p>
                <div className="space-y-3">
                  {porMes.map((m) => (
                    <div key={`${m.ano}-${m.mes}`} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white/60 dark:bg-amber-950/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2 capitalize">{m.label} · {(m.fornecedores ?? []).reduce((a, f) => a + (f?.emFalta ?? 0), 0)} em falta</p>
                      <div className="flex flex-wrap gap-2">
                        {m.fornecedores.map((f: any) => {
                          const chave = `${m.ano}-${m.mes}-${f.nome}`;
                          return (
                            <span key={f.nome} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-amber-950/30 pl-2.5 pr-1 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                              <AlertTriangle className="h-3 w-3" />{f.nome}
                              {f.esperado > 1 && <span className="text-[11px] text-amber-600 dark:text-amber-400">({f.contabilizadas}/{f.esperado})</span>}
                              <button onClick={() => abrirModalOk(f.nome, m.ano, m.mes, m.label, undefined, f.seguros)} disabled={okBusy === chave} title={f.seguros ? 'Validar seguros do mês' : 'Fatura já digitalizada — associar / dar como OK'} className="ml-0.5 p-0.5 rounded text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40 disabled:opacity-50">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {confirmadosBloco}
              </div>
            </div>
          </motion.div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards?.map((card: any, idx: number) => (
          <motion.div key={card?.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{card?.title}</span>
              <div className={`p-2 rounded-lg ${card?.color}`}>
                {card?.icon && <card.icon className={`h-4 w-4 ${card?.iconColor}`} />}
              </div>
            </div>
            <p className="text-xl font-bold font-display tracking-tight text-foreground">{card?.title === 'Pendentes' ? card?.value : mask(card?.value)}</p>
          </motion.div>
        ))}
      </div>

      {(data?.contas?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Contas Bancárias</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.contas ?? []).map((conta: any) => (
              <div key={conta?.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="font-medium text-sm">{conta?.nome}</p>
                <p className="text-xs text-muted-foreground">{conta?.banco}</p>
                <p className="text-lg font-bold font-mono mt-2">{mask(formatCurrency(conta?.saldoAtual))}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Fluxo do Mês Atual</h2>
        <div className="h-64"><FluxoChart recebimentos={data?.recebimentosMes ?? []} pagamentos={data?.pagamentosMes ?? []} /></div>
      </motion.div>

      {/* Saldo Diário */}
      {(data?.saldoDiario?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Saldo Diário (Mês Atual)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(data?.saldoDiario ?? []).map((d: any) => {
              const isPositive = d.saldo >= 0;
              const varPositive = d.variacao >= 0;
              return (
                <div key={d.dia} className={`p-3 rounded-lg border ${isPositive ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'}`}>
                  <p className="text-xs font-medium text-muted-foreground">{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</p>
                  <p className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{mask(formatCurrency(d.saldo))}</p>
                  <p className={`text-xs font-mono ${varPositive ? 'text-emerald-600' : 'text-red-600'}`}>{hideValues ? '•••' : `${varPositive ? '+' : ''}${formatCurrency(d.variacao)}`}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Despesas Fixas Mensais */}
      {data?.despesasPorCategoria && Object.keys(data.despesasPorCategoria).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />Despesas por Categoria</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(data.despesasPorCategoria).map(([cat, val]: [string, any]) => (
              <div key={cat} className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{CATEGORIAS[cat] || cat}</p><p className="text-lg font-bold">{mask(formatCurrency(val))}</p></div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recebimentos e Pagamentos em Falta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-emerald-600" />Recebimentos em Falta</h2>
          {(data?.recebimentosEmFalta?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Todos os recebimentos estão em dia! ✓</p>
          ) : (
            <div className="space-y-3">
              {(data?.recebimentosEmFalta ?? []).map((r: any) => (
                <div key={r?.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <div><p className="text-sm font-medium">{r?.descricao}</p><p className="text-xs text-muted-foreground">{r?.cliente?.nome ?? 'Sem cliente'} • {formatDate(r?.dataRecebimento)}</p></div>
                  <div className="text-right"><p className="text-sm font-bold font-mono text-red-600">{mask(formatCurrency(r?.valor))}</p><EstadoBadge estado={r?.estado} /></div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-red-600" />Pagamentos em Falta</h2>
          {(data?.pagamentosEmFalta?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Todos os pagamentos estão em dia! ✓</p>
          ) : (
            <div className="space-y-3">
              {(data?.pagamentosEmFalta ?? []).map((p: any) => (
                <div key={p?.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                  <div><p className="text-sm font-medium">{p?.descricao}</p><p className="text-xs text-muted-foreground">{p?.fornecedor?.nome ?? 'Sem fornecedor'} • {formatDate(p?.dataPagamento)}</p></div>
                  <div className="text-right"><p className="text-sm font-bold font-mono text-amber-700">{mask(formatCurrency(p?.valor))}</p><EstadoBadge estado={p?.estado} /></div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Faturas Pendentes de Pagamento */}
      {(data?.faturasPendentes?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-orange-600" />Faturas Pendentes de Pagamento</h2>
          <div className="space-y-2">
            {(data?.faturasPendentes ?? []).slice(0, 10).map((f: any) => (
              <div key={f?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div><p className="text-sm font-medium">{f?.numero || f?.descricao || 'Fatura'}</p><p className="text-xs text-muted-foreground">{f?.cliente?.nome || f?.fornecedor?.nome || '-'} {f?.dataVencimento ? `• Vence: ${formatDate(f.dataVencimento)}` : ''}</p></div>
                <p className="text-sm font-bold font-mono">{mask(formatCurrency(f?.valor))}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Modal: associar fatura digitalizada ao fornecedor fixo */}
      <AnimatePresence>
        {okModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setOkModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-card text-foreground rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">{okModal.seguros ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-emerald-600" />}{okModal.seguros ? 'Validar seguros' : 'Associar fatura'} — {okModal.fornecedor}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{okModal.label} · {okModal.seguros ? 'confirme os seguros do mês (data de emissão)' : 'escolha a fatura digitalizada correspondente'}</p>
                </div>
                <button onClick={() => setOkModal(null)} className="p-1 rounded-lg hover:bg-muted transition-colors" title="Fechar"><X className="h-4 w-4" /></button>
              </div>

              {!okModal.seguros && (
                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={faturaSearch}
                      onChange={(e) => setFaturaSearch(e.target.value)}
                      placeholder="Pesquisar por número, descrição, fornecedor ou valor..."
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {okModal.seguros ? (
                  (okModal.seguros.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Não há seguros mensais registados.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Seguros a validar — {okModal.label}</p>
                      {okModal.seguros.map((s: any) => (
                        <div key={s?.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20">
                          <div className="min-w-0 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{s?.label || 'Seguro'}</p>
                              <p className="text-xs text-muted-foreground truncate">Data de emissão: {s?.dataEmissao ? formatDate(s.dataEmissao) : '—'}</p>
                            </div>
                          </div>
                          <span className="text-sm font-mono font-semibold shrink-0">{formatCurrency(s?.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : faturasLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">A carregar faturas...</p>
                ) : (() => {
                  const termo = faturaSearch.trim().toLowerCase();
                  // IDs de faturas já associadas a outras despesas fixas — são
                  // excluídas da lista para não aparecerem outra vez (evita confusão).
                  // Exceção: a fatura associada à confirmação que está a ser editada
                  // mantém-se visível para poder ser trocada.
                  const associadasIds = new Set<string>();
                  (data?.fornecedoresFixosConfirmadosPorMes ?? []).forEach((mm: any) =>
                    (mm?.itens ?? []).forEach((it: any) => {
                      if (it?.faturaId && it?.id !== okModal.confirmacaoId) associadasIds.add(it.faturaId);
                    }),
                  );
                  const lista = (faturasDisp ?? [])
                    .filter((f: any) => f?.tipo === 'recebida' || f?.origem === 'fornecedor' || !!f?.fornecedorId)
                    .filter((f: any) => !associadasIds.has(f?.id))
                    .filter((f: any) => {
                      if (!termo) return true;
                      const alvo = `${f?.numero ?? ''} ${f?.descricao ?? ''} ${f?.fornecedor?.nome ?? ''} ${f?.entidadeNome ?? ''} ${f?.valor ?? ''}`.toLowerCase();
                      return alvo.includes(termo);
                    });
                  const doMes = lista.filter((f: any) => {
                    if (!f?.dataEmissao) return false;
                    const d = new Date(f.dataEmissao);
                    // okModal.mes vem do dashboard em base 0 (abril = 3).
                    return d.getFullYear() === okModal.ano && d.getMonth() === okModal.mes;
                  });
                  const outras = lista.filter((f: any) => !doMes.includes(f));
                  const renderRow = (f: any, destaque: boolean) => (
                    <button
                      key={f?.id}
                      onClick={() => confirmarFaturaFixaOk(f)}
                      disabled={!!okBusy}
                      className={`w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors disabled:opacity-50 ${destaque ? 'border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-border bg-background hover:bg-muted/60'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f?.numero || f?.descricao || 'Documento'}</p>
                        <p className="text-xs text-muted-foreground truncate">{f?.fornecedor?.nome || f?.entidadeNome || 'Sem fornecedor'} · {f?.dataEmissao ? formatDate(f.dataEmissao) : 'sem data'}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold shrink-0">{formatCurrency(f?.valor)}</span>
                    </button>
                  );
                  if (lista.length === 0) {
                    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma fatura digitalizada encontrada.</p>;
                  }
                  return (
                    <>
                      {doMes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Faturas de {okModal.label}</p>
                          {doMes.map((f: any) => renderRow(f, true))}
                        </div>
                      )}
                      {outras.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {doMes.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Outras faturas</p>}
                          {outras.map((f: any) => renderRow(f, false))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
                <p className="text-xs text-muted-foreground">{okModal.seguros ? 'Confirme que os seguros deste mês estão em dia.' : 'Não encontra a fatura? Pode confirmar sem associar.'}</p>
                <button
                  onClick={() => confirmarFaturaFixaOk(null)}
                  disabled={!!okBusy}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${okModal.seguros ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-border bg-background hover:bg-muted'}`}
                >
                  {okModal.seguros ? 'Confirmar validação' : 'Confirmar sem associar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pré-visualização de documento digitalizado (cópia da despesa fixa) */}
      <AnimatePresence>
        {docPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDocPreview(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-background rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">Documento da despesa fixa</h2>
                <div className="flex items-center gap-2">
                  {docPreview.url && <a href={docPreview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Nova aba</a>}
                  <button onClick={() => setDocPreview(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="p-4 overflow-auto">
                {docPreview.loading || !docPreview.url ? (
                  <div className="h-[60vh] flex items-center justify-center text-sm text-muted-foreground">A carregar documento…</div>
                ) : (
                  <FilePreviewFrame url={docPreview.url} className="w-full h-[70vh] rounded-lg" />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detalhe dos movimentos (Faturação / Despesas / Pagam. fornecedores desde abril) */}
      <AnimatePresence>
        {movModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMovModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="min-w-0">
                  <h2 className="font-semibold flex items-center gap-2">
                    {movModal.tipo === 'faturacao' && <FileText className="h-4 w-4 text-purple-600" />}
                    {movModal.tipo === 'despesas' && <ShoppingCart className="h-4 w-4 text-red-600" />}
                    {movModal.tipo === 'pagamentos' && <ArrowUpCircle className="h-4 w-4 text-orange-600" />}
                    {movModal.titulo}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel(movRange)} · {movItens.length} {movItens.length === 1 ? 'mês' : 'meses'} · Total {mask(formatCurrency(movTotal))}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => imprimirMovModal()} title="Imprimir" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Printer className="h-5 w-5" /></button>
                  <button onClick={() => setMovModal(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <DateRangeFilter value={movRange} onChange={setMovRange} defaultPreset="este_ano" />
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <span className="text-xs text-muted-foreground">Resumo · {rangeLabel(movRange)}</span>
                  <span className="text-sm font-bold font-display tabular-nums text-foreground">{movItens.length} {movItens.length === 1 ? 'mês' : 'meses'} · {mask(formatCurrency(movTotal))}</span>
                </div>
              </div>
              <div className="p-3 overflow-auto">
                {movItens.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Sem registos no período selecionado.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {movItens.map((it: any, idx: number) => (
                      <div key={it.id ?? idx} className="flex items-center justify-between gap-3 py-2.5 px-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{it.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {it.entidade || ''}
                          </p>
                        </div>
                        <p className={`text-sm font-bold tabular-nums shrink-0 ${movModal.tipo === 'faturacao' ? 'text-purple-600 dark:text-purple-400' : movModal.tipo === 'despesas' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>{mask(formatCurrency(it.valor))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-base font-bold font-display tabular-nums text-foreground">{mask(formatCurrency(movTotal))}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}