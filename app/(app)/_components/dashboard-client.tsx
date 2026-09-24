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
  Bell,
  CalendarClock,
  FileSearch,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { DateRangeFilter, dateInRange, rangeLabel, type DateRange } from '@/components/date-range-filter';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import dynamic from 'next/dynamic';

const MensalChart = dynamic(() => import('./mensal-chart'), { ssr: false, loading: () => <div className="h-64 bg-muted rounded-xl animate-pulse" /> });

export function DashboardClient() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role || '';
  const isInsercao = role === 'insercao';
  const [data, setData] = useState<any>(null);
  const [atencao, setAtencao] = useState<any>(null);
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
    // Os alertas carregam em paralelo e não atrasam o resto do painel.
    fetch('/api/dashboard/atencao')
      .then((r) => r.json())
      .then((d: any) => setAtencao(d?.error ? null : d))
      .catch(console.error);
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

  const CATEGORIAS: Record<string, string> = { material: 'Material', servicos: 'Serviços', renda: 'Renda', comunicacoes: 'Comunicações', transportes: 'Transportes', seguros: 'Seguros', manutencao: 'Manutenção', marketing: 'Marketing', financeiras: 'Desp. mensais', fornecedores: 'Fornecedores', combustiveis: 'Combustíveis', despesas_gerais: 'Despesas gerais', imobilizado: 'Imobilizado', outro: 'Outro' };
  const TIPO_AGENDA: Record<string, string> = { fatura: 'Fatura', imposto: 'Imposto', seguro: 'Seguro', vencimento: 'Vencimento', pagamento: 'Pagamento agendado', recebimento: 'Recebimento' };

  const faturacao = data?.faturacaoAcumulada ?? 0;
  const despesas = data?.despesasAcumuladas ?? 0;
  const pagFornecedores = data?.fornecedoresFaturado ?? data?.pagFornecedoresAcumulados ?? 0;
  const resultado = data?.resultadoAcumulado ?? (faturacao - despesas - pagFornecedores);
  const positivo = resultado >= 0;
  const aPagar = atencao?.aPagar;
  const aReceber = atencao?.aReceber;
  const al = atencao?.alertas;
  const fixasEmFalta: number = data?.fornecedoresFixosEmFaltaCount ?? 0;

  // Cartões do bloco "Precisa de atenção": só aparecem os que têm algo pendente.
  const alertas: { chave: string; n: number; texto: string; detalhe?: string; href: string; nivel: 'alto' | 'medio' | 'info'; icon: any }[] = [
    { chave: 'pagarVencido', n: aPagar?.vencidos ?? 0, texto: 'por pagar com data ultrapassada', detalhe: aPagar ? mask(formatCurrency(aPagar.valorVencido)) : undefined, href: '#agenda', nivel: 'alto' as const, icon: AlertTriangle },
    { chave: 'receberVencido', n: aReceber?.vencidos ?? 0, texto: 'faturas de clientes por receber em atraso', detalhe: aReceber ? mask(formatCurrency(aReceber.valorVencido)) : undefined, href: '#agenda', nivel: 'alto' as const, icon: ArrowDownCircle },
    { chave: 'fixas', n: fixasEmFalta, texto: 'faturas fixas mensais em falta', href: '#faturas-fixas', nivel: 'medio' as const, icon: Receipt },
    { chave: 'efatura', n: al?.efatura?.emFalta ?? 0, texto: 'documentos do e-Fatura em falta na app', detalhe: al?.efatura ? `${al.efatura.mes} · ${mask(formatCurrency(al.efatura.valorEmFalta))}` : undefined, href: '/efatura', nivel: 'medio' as const, icon: FileSearch },
    { chave: 'impostos', n: al?.impostosAVencer ?? 0, texto: 'impostos vencidos ou a vencer em 15 dias', href: '/impostos', nivel: 'medio' as const, icon: Landmark },
    { chave: 'digit', n: (al?.digitalizacoesPorConfirmar ?? 0) + (al?.digitalizacoesComErro ?? 0), texto: 'digitalizações por confirmar', detalhe: al?.digitalizacoesComErro ? `${al.digitalizacoesComErro} com erro` : undefined, href: '/digitalizacoes', nivel: 'info' as const, icon: ScanLine },
    { chave: 'conciliar', n: al?.movimentosPorConciliar ?? 0, texto: 'movimentos bancários por conciliar', detalhe: 'as faturas pagas só saem de "a pagar" depois de conciliadas', href: '/reconciliacao', nivel: 'info' as const, icon: Landmark },
    { chave: 'faltas', n: al?.faltasPorDecidir ?? 0, texto: 'justificações de faltas por decidir', href: '/ponto/admin', nivel: 'info' as const, icon: CalendarDays },
    { chave: 'ferias', n: al?.feriasPorDecidir ?? 0, texto: 'pedidos de férias por decidir', href: '/ponto/admin', nivel: 'info' as const, icon: CalendarDays },
  ].filter((a) => a.n > 0);
  const COR_NIVEL = {
    alto: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    medio: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300',
  } as const;

  const hojeISO = new Date().toISOString().slice(0, 10);
  const listaAgenda = (itens: any[], vazio: string) => {
    const atrasados = (itens ?? []).filter((i) => i.vencido).reverse(); // mais recentes primeiro
    const proximos = (itens ?? []).filter((i) => !i.vencido);
    const linha = (i: any) => (
      <Link key={`${i.tipo}-${i.id}`} href={i.href} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/40 -mx-2 px-2 rounded">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{i.entidade || i.descricao}</p>
          <p className={`text-xs truncate ${i.vencido ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
            {i.data ? (i.vencido ? `Desde ${formatDate(i.data)}` : i.data.slice(0, 10) === hojeISO ? 'Hoje' : formatDate(i.data)) : 'Sem data'} · {i.entidade ? i.descricao : TIPO_AGENDA[i.tipo]}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{mask(formatCurrency(i.valor))}</span>
      </Link>
    );
    if (atrasados.length === 0 && proximos.length === 0) return <p className="text-sm text-muted-foreground py-4">{vazio}</p>;
    return (
      <div>
        {proximos.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Próximos</p>
            {proximos.slice(0, 6).map(linha)}
          </div>
        )}
        {atrasados.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Em atraso · {atrasados.length}</p>
            {atrasados.slice(0, 6).map(linha)}
            {atrasados.length > 6 && <p className="text-xs text-muted-foreground pt-2">e mais {atrasados.length - 6}…</p>}
          </div>
        )}
      </div>
    );
  };

  const categorias = Object.entries(data?.despesasPorCategoria ?? {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const maxCategoria = Math.max(1, ...categorias.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Visão geral da situação financeira da CRIACONSENSOS"
        action={
          <button
            type="button"
            onClick={toggleHideValues}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition"
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{hideValues ? 'Mostrar valores' : 'Ocultar valores'}</span>
          </button>
        }
      />

      {/* 1. Números principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" />Saldo em bancos</p>
          <p className="text-2xl font-bold font-display tabular-nums mt-1">{mask(formatCurrency(data?.saldoTotal))}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{(data?.contas ?? []).length} conta{(data?.contas ?? []).length === 1 ? '' : 's'} ativa{(data?.contas ?? []).length === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-xl p-4 border shadow-sm ${positivo ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'}`}>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">{positivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}Resultado desde janeiro</p>
          <p className={`text-2xl font-bold font-display tabular-nums mt-1 ${positivo ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{hideValues ? '••••••' : `${positivo ? '+' : '−'} ${formatCurrency(Math.abs(resultado))}`}</p>
          <p className="text-xs text-muted-foreground mt-0.5">faturação − despesas − fornecedores</p>
        </div>
        <a href="#agenda" className="bg-card rounded-xl p-4 border border-border shadow-sm hover:border-emerald-400 transition">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />A receber de clientes</p>
          <p className="text-2xl font-bold font-display tabular-nums mt-1">{aReceber ? mask(formatCurrency(aReceber.total)) : '—'}</p>
          <p className={`text-xs mt-0.5 ${aReceber?.vencidos ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{aReceber ? (aReceber.vencidos ? `${aReceber.vencidos} em atraso` : `${aReceber.quantidade} fatura${aReceber.quantidade === 1 ? '' : 's'}`) : 'a carregar…'}</p>
        </a>
        <a href="#agenda" className="bg-card rounded-xl p-4 border border-border shadow-sm hover:border-red-400 transition">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />A pagar (sem pagamento registado)</p>
          <p className="text-2xl font-bold font-display tabular-nums mt-1">{aPagar ? mask(formatCurrency(aPagar.total)) : '—'}</p>
          <p className={`text-xs mt-0.5 ${aPagar?.vencidos ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{aPagar ? (aPagar.vencidos ? `${aPagar.vencidos} com data ultrapassada` : `${aPagar.quantidade} documento${aPagar.quantidade === 1 ? '' : 's'}`) : 'a carregar…'}</p>
        </a>
      </div>

      {/* Detalhe do resultado (abre por mês) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button type="button" onClick={() => setMovModal({ tipo: 'faturacao', titulo: 'Faturação desde janeiro', itens: data?.movimentosFaturacao ?? [], total: faturacao })} className="text-left rounded-xl bg-card border border-border p-3 hover:border-purple-400 transition group">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-purple-600" />Faturação desde janeiro</p>
          <p className="text-lg font-bold font-display tabular-nums">{mask(formatCurrency(faturacao))}</p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1"><Eye className="h-3 w-3" />Ver por mês</p>
        </button>
        <button type="button" onClick={() => setMovModal({ tipo: 'despesas', titulo: 'Despesas desde janeiro', itens: data?.movimentosDespesas ?? [], total: despesas })} className="text-left rounded-xl bg-card border border-border p-3 hover:border-amber-400 transition group">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-amber-600" />Despesas desde janeiro</p>
          <p className="text-lg font-bold font-display tabular-nums">{mask(formatCurrency(despesas))}</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><Eye className="h-3 w-3" />Ver por mês</p>
        </button>
        <button type="button" onClick={() => setMovModal({ tipo: 'pagamentos', titulo: 'Faturado por fornecedores, por mês (desde janeiro)', itens: data?.movimentosPagamentosFornecedores ?? [], total: pagFornecedores })} className="text-left rounded-xl bg-card border border-border p-3 hover:border-red-400 transition group">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />Fornecedores — faturado desde janeiro</p>
          <p className="text-lg font-bold font-display tabular-nums">{mask(formatCurrency(pagFornecedores))}</p>
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1"><Eye className="h-3 w-3" />Ver por mês</p>
        </button>
      </div>

      {/* 2. Precisa de atenção */}
      <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Bell className="h-5 w-5 text-amber-600" />Precisa de atenção</h2>
        {!atencao ? (
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
        ) : alertas.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Está tudo em dia.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {alertas.map((a) => {
              const Icon = a.icon;
              const conteudo = (
                <>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm"><span className="font-bold tabular-nums">{a.n}</span> {a.texto}</p>
                    {a.detalhe && <p className="text-xs opacity-80 truncate">{a.detalhe}</p>}
                  </div>
                </>
              );
              const cls = `flex items-start gap-2 rounded-lg border p-3 hover:shadow-sm transition ${COR_NIVEL[a.nivel]}`;
              return a.href.startsWith('#') ? (
                <a key={a.chave} href={a.href} className={cls}>{conteudo}</a>
              ) : (
                <Link key={a.chave} href={a.href} className={cls}>{conteudo}</Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. A pagar / a receber */}
      <div id="agenda" className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-20">
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-base font-semibold flex items-center gap-2"><CalendarClock className="h-5 w-5 text-red-600" />Pagamentos</h2>
            {aPagar && <span className="text-sm text-muted-foreground tabular-nums">{mask(formatCurrency(aPagar.total))}</span>}
          </div>
          {!atencao ? <div className="h-40 bg-muted rounded-lg animate-pulse" /> : listaAgenda(aPagar?.itens ?? [], 'Não há nada por pagar.')}
        </section>
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-base font-semibold flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-emerald-600" />A receber de clientes</h2>
            {aReceber && <span className="text-sm text-muted-foreground tabular-nums">{mask(formatCurrency(aReceber.total))}</span>}
          </div>
          {!atencao ? <div className="h-40 bg-muted rounded-lg animate-pulse" /> : listaAgenda(aReceber?.itens ?? [], 'Não há faturas por receber.')}
        </section>
      </div>

      {/* 4. Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Faturação e custos por mês</h2>
          <div className="h-64">
            <MensalChart faturacao={data?.movimentosFaturacao ?? []} despesas={data?.movimentosDespesas ?? []} fornecedores={data?.movimentosPagamentosFornecedores ?? []} ocultar={hideValues} />
          </div>
        </section>
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />Despesas por categoria</h2>
          {categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas pagas.</p>
          ) : (
            <div className="space-y-2.5">
              {categorias.slice(0, 8).map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1"><span>{CATEGORIAS[cat] || cat}</span><span className="tabular-nums text-muted-foreground">{mask(formatCurrency(val))}</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((val / maxCategoria) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5. Contas bancárias e saldo diário */}
      {(data?.contas?.length ?? 0) > 0 && (
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Contas bancárias</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(data?.contas ?? []).map((conta: any) => (
              <div key={conta?.id} className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">{conta?.nome}</p>
                <p className="text-xs text-muted-foreground">{conta?.banco}</p>
                <p className={`text-lg font-bold tabular-nums mt-1 ${(conta?.saldoAtual ?? 0) < 0 ? 'text-red-600' : ''}`}>{mask(formatCurrency(conta?.saldoAtual))}</p>
              </div>
            ))}
          </div>
          {(data?.saldoDiario?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Saldo diário do mês</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(data?.saldoDiario ?? []).map((d: any) => (
                  <div key={d.dia} className={`shrink-0 px-3 py-2 rounded-lg border text-xs ${d.saldo >= 0 ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900'}`}>
                    <p className="text-muted-foreground">{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</p>
                    <p className="font-semibold tabular-nums">{mask(formatCurrency(d.saldo))}</p>
                    <p className={`tabular-nums ${d.variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{hideValues ? '•••' : `${d.variacao >= 0 ? '+' : ''}${formatCurrency(d.variacao)}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Faturas fixas mensais (detalhe) */}
      <div id="faturas-fixas" className="scroll-mt-20">
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

      </div>

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