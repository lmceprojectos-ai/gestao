'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Scale, TrendingUp, TrendingDown, DollarSign, Activity, Landmark, Search, ListFilter,
  ArrowUpDown, ChevronLeft, ChevronRight, Loader2, DatabaseBackup, Upload, Banknote, UserRound, BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';

const GraficoTrimestres = dynamic(() => import('./graficos').then((m) => m.GraficoTrimestres), { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> });
const GraficoCategorias = dynamic(() => import('./graficos').then((m) => m.GraficoCategorias), { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> });

// Balancete (trazido de balancete2026.abacusai.app): dashboard, movimentos,
// contas e relatórios. O que entra aparece a verde e o que sai a vermelho.

type Conta = { id: string; nome: string; saldo: number; saldoAbertura: number; dataAbertura: string | null; receitas: number; despesas: number; entrada: number; saida: number; saldoDoAno: number; movimentos: number };
type Dashboard = {
  totalReceitas: number; totalDespesas: number; resultado: number; totalMovimentos: number; saldoTotal: number;
  contas: Conta[]; trimestres: { trimestre: string; receitas: number; despesas: number; margem: number }[];
  categorias: { nome: string; valor: number }[];
};
type Movimento = {
  id: string; data: string; valor: number; descricao: string; metodo: string | null; conta: string; categoria: string | null;
  subcategoria: string | null; fiscal: string | null; tipo: string; trimestre: string; nota: string | null;
  origem: string | null; destino: string | null;
};
type Listas = { categorias: string[]; subcategorias: string[]; metodos: string[]; contas: string[]; anos: number[] };

const SEPARADORES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sumario', label: 'Sumário' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'internos', label: 'Mov. Internos' },
  { key: 'movimentos', label: 'Movimentos' },
  { key: 'contas', label: 'Contas' },
  { key: 'relatorios', label: 'Relatórios' },
] as const;
type Separador = (typeof SEPARADORES)[number]['key'];

const TIPO_LABEL: Record<string, string> = { RECEITA: 'Receita', DESPESA: 'Despesa', INTERNO: 'Interno' };
const TIPO_COR: Record<string, string> = {
  RECEITA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DESPESA: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  INTERNO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
const corValor = (v: number) => (v >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400');

export default function BalancetePage() {
  const [separador, setSeparador] = useState<Separador>('dashboard');
  // Ano mostrado: por defeito o ano atual; os anteriores escolhem-se ao lado dos separadores.
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [anos, setAnos] = useState<number[]>([new Date().getFullYear()]);
  // Muda depois de uma importação, para as listas se voltarem a carregar.
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    fetch('/api/balancete/listas').then((r) => r.json()).then((l) => { if (Array.isArray(l?.anos) && l.anos.length) setAnos(l.anos); }).catch(() => {});
  }, []);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDashboard = useCallback(() => {
    setDash(null);
    fetch(`/api/balancete?ano=${ano}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error || 'Erro'); return d; })
      .then((d) => { setDash(d); setErro(null); })
      .catch((e) => setErro(e.message));
  }, [ano]);
  useEffect(() => { carregarDashboard(); }, [carregarDashboard]);

  const vazio = dash && dash.totalMovimentos === 0 && dash.contas.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader icon={Scale} title="Balancete" description={`Visão geral financeira do ano fiscal ${ano}`}
        action={<ImportarFicheiro onFeito={() => { carregarDashboard(); setVersao((v) => v + 1); fetch('/api/balancete/listas').then((r) => r.json()).then((l) => { if (Array.isArray(l?.anos) && l.anos.length) setAnos(l.anos); }).catch(() => {}); }} />} />

      <div className="flex items-end gap-1 border-b border-border overflow-x-auto">
        {SEPARADORES.map((s) => (
          <button key={s.key} onClick={() => setSeparador(s.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${separador === s.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {s.label}
          </button>
        ))}
        <label className="ml-auto mb-1.5 flex items-center gap-2 text-sm shrink-0">
          <span className="text-muted-foreground">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
            className="px-3 py-1.5 border border-input rounded-lg text-sm font-semibold bg-background text-foreground">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {vazio && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 p-4 text-sm flex items-center gap-3">
          <DatabaseBackup className="h-5 w-5 shrink-0" />
          <span>{ano !== new Date().getFullYear() ? `Sem movimentos em ${ano}.` : 'O balancete ainda não tem dados.'} Em <Link href="/backups" className="underline font-medium">Backups</Link>, carregue em "Repor no Balancete" no backup do balancete2026.</span>
        </div>
      )}

      {separador === 'dashboard' && <SeparadorDashboard dash={dash} />}
      {separador === 'sumario' && <SeparadorSumario dash={dash} ano={ano} />}
      {separador === 'receitas' && <SeparadorLista key={`r${versao}`} ano={ano} tipo="RECEITA" onAlterado={carregarDashboard} />}
      {separador === 'despesas' && <SeparadorLista key={`d${versao}`} ano={ano} tipo="DESPESA" onAlterado={carregarDashboard} />}
      {separador === 'internos' && <SeparadorLista key={`i${versao}`} ano={ano} tipo="INTERNO" onAlterado={carregarDashboard} />}
      {separador === 'movimentos' && <SeparadorMovimentos key={`m${versao}`} ano={ano} onAlterado={carregarDashboard} />}
      {separador === 'contas' && <SeparadorContas contas={dash?.contas ?? null} saldoTotal={dash?.saldoTotal ?? 0} />}
      {separador === 'relatorios' && <SeparadorRelatorios ano={ano} />}
    </div>
  );
}

// Valores como no balancete2026: "€90 746,80".
const euro = (v: number) => `€${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Cartao({ titulo, valor, cor, icon: Icon, fundo }: { titulo: string; valor: string; cor?: string; icon: any; fundo: string }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${cor ?? ''}`}>{valor}</p>
      </div>
      <div className={`p-2.5 rounded-lg shrink-0 ${fundo}`}><Icon className="h-5 w-5" /></div>
    </div>
  );
}

// Cores das contas bancárias (como no site); as outras usam azul.
const ESTILO_CONTA: Record<string, { fundo: string; bola: string }> = {
  cgd: { fundo: 'from-orange-500 via-orange-600 to-amber-800', bola: 'bg-yellow-300' },
  montepio: { fundo: 'from-emerald-600 via-emerald-700 to-emerald-900', bola: 'bg-green-500' },
};
const estiloConta = (nome: string) => ESTILO_CONTA[nome.toLowerCase()] ?? { fundo: 'from-blue-600 via-blue-700 to-blue-900', bola: 'bg-sky-300' };

function SeparadorDashboard({ dash }: { dash: Dashboard | null }) {
  if (!dash) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  // Contas bancárias: com movimentos ou saldo; as outras (sócia, gerente, caixa) em cartões pequenos.
  const PEQUENAS = ['sócia', 'gerente', 'cash', 'caixa', 'sem conta'];
  const bancarias = dash.contas.filter((c) => !PEQUENAS.includes(c.nome.toLowerCase()) && (c.movimentos > 0 || c.saldo !== 0));
  const ORDEM = ['sócia', 'gerente', 'cash', 'sem conta'];
  const pos = (n: string) => { const i = ORDEM.indexOf(n.toLowerCase()); return i < 0 ? 99 : i; };
  const outras = dash.contas.filter((c) => !bancarias.includes(c)).sort((a, b) => pos(a.nome) - pos(b.nome));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Cartao titulo="Total Receitas" valor={euro(dash.totalReceitas)} cor="text-emerald-600" icon={TrendingUp} fundo="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" />
        <Cartao titulo="Total Despesas" valor={euro(dash.totalDespesas)} cor="text-red-600" icon={TrendingDown} fundo="bg-red-50 text-red-600 dark:bg-red-900/30" />
        <Cartao titulo="Resultado Líquido" valor={euro(dash.resultado)} cor={dash.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} icon={DollarSign} fundo="bg-blue-50 text-blue-600 dark:bg-blue-900/30" />
        <Cartao titulo="Movimentos" valor={String(dash.totalMovimentos)} icon={Activity} fundo="bg-purple-50 text-purple-600 dark:bg-purple-900/30" />
      </div>

      <div className="rounded-xl p-5 border-2 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900/50 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300 flex items-center gap-2"><Landmark className="h-4 w-4" />SALDO BANCÁRIO TOTAL</p>
          <p className="text-4xl font-bold font-mono tabular-nums mt-1">{euro(dash.saldoTotal)}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"><Landmark className="h-7 w-7" /></div>
      </div>

      {bancarias.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bancarias.map((c) => {
            const e = estiloConta(c.nome);
            return (
              <div key={c.id} className={`rounded-xl p-6 text-white shadow-md bg-gradient-to-br ${e.fundo}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-9 w-9 rounded-full border-2 border-black/80 ${e.bola}`} />
                    <div>
                      <p className="text-lg font-bold">{c.nome}</p>
                      <p className="text-xs text-white/80">Conta Bancária</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/20 flex items-center gap-1">
                    {c.saldo >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{c.saldo >= 0 ? 'Positivo' : 'Negativo'}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wide text-white/80 mt-5">Saldo atual</p>
                <p className="text-4xl font-bold font-mono tabular-nums">{euro(c.saldo)}</p>
                <div className="border-t border-white/25 mt-4 pt-3 flex justify-between text-xs text-white/85">
                  <span>Saldo abertura: {euro(c.saldoAbertura)}</span>
                  <span>{c.dataAbertura ? formatDate(c.dataAbertura) : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {outras.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {outras.map((c) => {
            const Icon = /cash|caixa/i.test(c.nome) ? Banknote : UserRound;
            return (
              <div key={c.id} className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
                <Icon className="h-6 w-6 mx-auto text-slate-700 dark:text-slate-300" />
                <p className="text-sm text-muted-foreground mt-2">{c.nome}</p>
                <p className={`font-bold font-mono tabular-nums ${c.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(c.saldo)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4" />Receitas vs Despesas por Trimestre</h2>
          <GraficoTrimestres dados={dash.trimestres} />
        </section>
        <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2"><PieChartIcon className="h-4 w-4" />Despesas por Categoria</h2>
          {dash.categorias.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas.</p> : <GraficoCategorias dados={dash.categorias} />}
        </section>
      </div>

      <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Activity className="h-4 w-4" />Margem por Trimestre</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {dash.trimestres.map((t) => (
            <div key={t.trimestre} className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-lg font-semibold">{t.trimestre}</p>
              <p className={`text-xl font-bold font-mono tabular-nums ${t.margem >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{t.margem.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">R: {euro(t.receitas).replace(',00', '')} | D: {euro(t.despesas).replace(',00', '')}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SeparadorMovimentos({ ano, onAlterado }: { ano: number; onAlterado: () => void }) {
  const [listas, setListas] = useState<Listas>({ categorias: [], subcategorias: [], metodos: [], contas: [], anos: [] });
  const [q, setQ] = useState('');
  const [procura, setProcura] = useState('');
  const [filtros, setFiltros] = useState({ trimestre: '', tipo: '', categoria: '', conta: '' });
  const [verFiltros, setVerFiltros] = useState(false);
  const [ordem, setOrdem] = useState<{ campo: 'data' | 'valor'; dir: 'asc' | 'desc' }>({ campo: 'data', dir: 'desc' });
  const [pagina, setPagina] = useState(1);
  const [res, setRes] = useState<{ movimentos: Movimento[]; total: number; paginas: number } | null>(null);
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  useEffect(() => { fetch('/api/balancete/listas').then((r) => r.json()).then(setListas).catch(() => {}); }, []);
  // Pesquisa por descrição com uma pequena pausa enquanto se escreve.
  useEffect(() => { const t = setTimeout(() => { setProcura(q); setPagina(1); }, 300); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    const qs = new URLSearchParams({ ano: String(ano), q: procura, ...filtros, pagina: String(pagina), ordem: ordem.campo, dir: ordem.dir });
    fetch(`/api/balancete/movimentos?${qs}`).then((r) => r.json()).then(setRes).catch(() => {});
  }, [ano, procura, filtros, pagina, ordem]);
  useEffect(() => { setPagina(1); }, [ano]);

  const mudarFiltro = (k: keyof typeof filtros, v: string) => { setFiltros((f) => ({ ...f, [k]: v })); setPagina(1); };
  const ordenar = (campo: 'data' | 'valor') =>
    setOrdem((o) => ({ campo, dir: o.campo === campo && o.dir === 'desc' ? 'asc' : 'desc' }));

  const classificar = async (m: Movimento, campo: 'categoria' | 'subcategoria' | 'fiscal', valor: string) => {
    setAGuardar(m.id);
    try {
      const r = await fetch(`/api/balancete/movimentos/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }),
      });
      if (!r.ok) throw new Error();
      const novo = await r.json();
      setRes((s) => s && { ...s, movimentos: s.movimentos.map((x) => (x.id === m.id ? novo : x)) });
      if (campo === 'categoria') onAlterado();
    } catch {
      toast.error('Não foi possível guardar');
    } finally {
      setAGuardar(null);
    }
  };

  const sel = 'px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground';
  return (
    <section className="bg-card rounded-xl border border-border shadow-sm">
      <div className="p-4 space-y-3 border-b border-border">
        <p className="text-sm text-muted-foreground">{res ? `${res.total} movimentos` : 'A carregar…'}</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por descrição…" className={`${sel} w-full pl-9`} />
          </div>
          <button onClick={() => setVerFiltros((v) => !v)} className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg text-sm font-medium hover:bg-muted">
            <ListFilter className="h-4 w-4" />Filtros
          </button>
        </div>
        {verFiltros && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <select value={filtros.trimestre} onChange={(e) => mudarFiltro('trimestre', e.target.value)} className={sel}>
              <option value="">Todos os Trimestres</option>{['Q1', 'Q2', 'Q3', 'Q4'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={filtros.tipo} onChange={(e) => mudarFiltro('tipo', e.target.value)} className={sel}>
              <option value="">Todos os Tipos</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option><option value="INTERNO">Interno</option>
            </select>
            <select value={filtros.categoria} onChange={(e) => mudarFiltro('categoria', e.target.value)} className={sel}>
              <option value="">Todas as Categorias</option><option value="__sem__">Sem categoria</option>
              {listas.categorias.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={filtros.conta} onChange={(e) => mudarFiltro('conta', e.target.value)} className={sel}>
              <option value="">Todas as Contas</option>{listas.contas.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left font-medium px-3 py-2"><button onClick={() => ordenar('data')} className="flex items-center gap-1">Data<ArrowUpDown className="h-3 w-3" /></button></th>
              <th className="text-left font-medium px-3 py-2">Tipo</th>
              <th className="text-left font-medium px-3 py-2">Descrição</th>
              <th className="text-left font-medium px-3 py-2">Conta</th>
              <th className="text-left font-medium px-3 py-2">Categoria</th>
              <th className="text-right font-medium px-3 py-2"><button onClick={() => ordenar('valor')} className="flex items-center gap-1 ml-auto">Valor<ArrowUpDown className="h-3 w-3" /></button></th>
              <th className="text-left font-medium px-3 py-2">Fiscal</th>
            </tr>
          </thead>
          <tbody>
            {(res?.movimentos ?? []).map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDate(m.data)}</td>
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_COR[m.tipo] ?? ''}`}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span></td>
                <td className="px-3 py-2 max-w-[280px]">
                  <div className="truncate" title={m.descricao}>{m.descricao.replace(/\s{2,}/g, ' ')}</div>
                  {m.nota && <div className="text-[11px] text-muted-foreground truncate">{m.nota}</div>}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{m.conta}</td>
                <td className="px-3 py-2">
                  <select value={m.categoria ?? ''} disabled={aGuardar === m.id} onChange={(e) => classificar(m, 'categoria', e.target.value)}
                    className="max-w-[150px] px-2 py-1 border border-input rounded text-xs bg-background text-foreground">
                    <option value="">—</option>{listas.categorias.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${m.tipo === 'INTERNO' ? 'text-muted-foreground' : corValor(m.valor)}`}>{formatCurrency(m.valor)}</td>
                <td className="px-3 py-2">
                  <input defaultValue={m.fiscal ?? ''} disabled={aGuardar === m.id} placeholder="—"
                    onBlur={(e) => { if ((e.target.value || '') !== (m.fiscal ?? '')) classificar(m, 'fiscal', e.target.value); }}
                    className="w-24 px-2 py-1 border border-input rounded text-xs bg-background text-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!res && <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      </div>
      {res && res.paginas > 1 && (
        <div className="flex items-center justify-center gap-3 p-3 border-t border-border text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="p-1.5 rounded border border-input disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span>Página {pagina} de {res.paginas}</span>
          <button disabled={pagina >= res.paginas} onClick={() => setPagina((p) => p + 1)} className="p-1.5 rounded border border-input disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}

function SeparadorContas({ contas, saldoTotal }: { contas: Conta[] | null; saldoTotal: number }) {
  if (!contas) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
        <p className="text-sm text-muted-foreground">Saldo Total Calculado</p>
        <p className={`text-3xl font-bold font-mono tabular-nums ${corValor(saldoTotal)}`}>{formatCurrency(saldoTotal)}</p>
        <p className="text-xs text-muted-foreground mt-1">Saldo de abertura + movimentos registados depois da data de abertura, até ao fim do ano escolhido. Receitas e despesas do ano escolhido.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contas.map((c) => (
          <div key={c.id} className="bg-card rounded-xl p-5 border border-border shadow-sm space-y-3">
            <div>
              <p className="text-lg font-semibold">{c.nome}</p>
              <p className="text-xs text-muted-foreground">Saldo atual (calculado)</p>
              <p className={`text-2xl font-bold font-mono tabular-nums ${corValor(c.saldo)}`}>{formatCurrency(c.saldo)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-muted-foreground">Abertura{c.dataAbertura ? ` (${formatDate(c.dataAbertura)})` : ''}</p><p className="font-mono font-semibold">{formatCurrency(c.saldoAbertura)}</p></div>
              <div><p className="text-muted-foreground">Receitas</p><p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(c.receitas)}</p></div>
              <div><p className="text-muted-foreground">Despesas</p><p className="font-mono font-semibold text-red-700 dark:text-red-400">{formatCurrency(c.despesas)}</p></div>
            </div>
            <p className="text-xs text-muted-foreground">{c.movimentos} movimentos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeparadorRelatorios({ ano }: { ano: number }) {
  const [dados, setDados] = useState<any>(null);
  const [vista, setVista] = useState<'categoria' | 'trimestre' | 'fiscais'>('categoria');
  useEffect(() => { setDados(null); fetch(`/api/balancete/relatorios?ano=${ano}`).then((r) => r.json()).then(setDados).catch(() => {}); }, [ano]);
  if (!dados) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  const totalR = (l: any[]) => l.reduce((s, x) => s + x.receitas, 0);
  const totalD = (l: any[]) => l.reduce((s, x) => s + x.despesas, 0);
  const botao = (k: typeof vista, label: string) => (
    <button onClick={() => setVista(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${vista === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}>{label}</button>
  );
  const th = 'text-left font-medium px-3 py-2';
  const tdR = 'px-3 py-2 text-right font-mono tabular-nums';

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm">
      <div className="p-4 flex flex-wrap gap-2 border-b border-border">
        {botao('categoria', 'Por Categoria')}{botao('trimestre', 'Por Trimestre')}{botao('fiscais', 'Movimentos Fiscais')}
      </div>
      <div className="overflow-x-auto">
        {vista === 'categoria' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className={th}>Categoria</th><th className={`${th} text-right`}>Receitas</th><th className={`${th} text-right`}>Despesas</th><th className={`${th} text-right`}>Balanço</th></tr></thead>
            <tbody>
              {dados.porCategoria.map((c: any) => (
                <tr key={c.nome} className="border-b border-border"><td className="px-3 py-2">{c.nome}</td><td className={`${tdR} text-emerald-700 dark:text-emerald-400`}>{formatCurrency(c.receitas)}</td><td className={`${tdR} text-red-700 dark:text-red-400`}>{formatCurrency(c.despesas)}</td><td className={`${tdR} ${corValor(c.balanco)}`}>{formatCurrency(c.balanco)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="px-3 py-2">TOTAL</td><td className={`${tdR} text-emerald-700 dark:text-emerald-400`}>{formatCurrency(totalR(dados.porCategoria))}</td><td className={`${tdR} text-red-700 dark:text-red-400`}>{formatCurrency(totalD(dados.porCategoria))}</td><td className={`${tdR} ${corValor(totalR(dados.porCategoria) - totalD(dados.porCategoria))}`}>{formatCurrency(totalR(dados.porCategoria) - totalD(dados.porCategoria))}</td></tr>
            </tbody>
          </table>
        )}
        {vista === 'trimestre' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className={th}>Trimestre</th><th className={`${th} text-right`}>Receitas</th><th className={`${th} text-right`}>Despesas</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody>
              {dados.porTrimestre.map((t: any) => (
                <tr key={t.trimestre} className="border-b border-border"><td className="px-3 py-2">{t.trimestre}</td><td className={`${tdR} text-emerald-700 dark:text-emerald-400`}>{formatCurrency(t.receitas)}</td><td className={`${tdR} text-red-700 dark:text-red-400`}>{formatCurrency(t.despesas)}</td><td className={`${tdR} ${corValor(t.total)}`}>{formatCurrency(t.total)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {vista === 'fiscais' && (dados.fiscais.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum movimento marcado como fiscal.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className={th}>Data</th><th className={th}>Descrição</th><th className={th}>Conta</th><th className={th}>Fiscal</th><th className={`${th} text-right`}>Valor</th></tr></thead>
            <tbody>
              {dados.fiscais.map((m: any) => (
                <tr key={m.id} className="border-b border-border"><td className="px-3 py-2 font-mono text-xs">{formatDate(m.data)}</td><td className="px-3 py-2">{m.descricao}</td><td className="px-3 py-2 text-xs">{m.conta}</td><td className="px-3 py-2 text-xs">{m.fiscal}</td><td className={`${tdR} ${corValor(m.valor)}`}>{formatCurrency(m.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

// ---------- Importar ficheiro (Excel do balancete ou extrato de um trimestre) ----------
function ImportarFicheiro({ onFeito }: { onFeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [contas, setContas] = useState<string[]>([]);
  const [conta, setConta] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) fetch('/api/balancete/listas').then((r) => r.json()).then((l) => setContas(l?.contas ?? [])).catch(() => {});
  }, [aberto]);

  const enviar = async (file: File) => {
    setAEnviar(true);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (conta) fd.append('conta', conta);
      const r = await fetch('/api/balancete/importar', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Erro ao importar');
      setResultado(d);
      toast.success(`Importado: ${d.receitas} receitas, ${d.despesas} despesas, ${d.internos} mov. internos${d.repetidos ? ` (${d.repetidos} já existiam)` : ''}`, { duration: 8000 });
      onFeito();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar');
    } finally {
      setAEnviar(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
        <Upload className="h-4 w-4" />Importar ficheiro
      </button>
      {aberto && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] z-20 bg-card border border-border rounded-xl shadow-lg p-4 space-y-3 text-sm">
          <p className="text-muted-foreground">
            Excel do balancete (folhas Despesas/Receitas Q1–Q4 e Mov. Internos) ou o extrato de um trimestre (.xlsx ou .csv).
            No extrato, valores <span className="text-red-600 font-medium">negativos</span> vão para Despesas e <span className="text-emerald-600 font-medium">positivos</span> para Receitas; o trimestre sai da data.
            Movimentos que já existam não são repetidos.
          </p>
          <label className="block">
            <span className="text-xs text-muted-foreground">Conta (só para extratos sem coluna de conta)</span>
            <select value={conta} onChange={(e) => setConta(e.target.value)} className="mt-1 w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground">
              <option value="">—</option>{contas.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button onClick={() => input.current?.click()} disabled={aEnviar} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-60">
            {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{aEnviar ? 'A importar…' : 'Escolher ficheiro'}
          </button>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }} />
          {resultado && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <p><strong>{resultado.receitas}</strong> receitas, <strong>{resultado.despesas}</strong> despesas e <strong>{resultado.internos}</strong> movimentos internos novos{resultado.repetidos ? <>; <strong>{resultado.repetidos}</strong> já existiam</> : null}.</p>
              {Object.keys(resultado.porAno ?? {}).length > 0 && <p>Por ano: {Object.entries(resultado.porAno).map(([a, n]) => `${a}: ${n}`).join(' · ')}</p>}
              {(resultado.avisos ?? []).map((a: string, i: number) => <p key={i} className="text-amber-700 dark:text-amber-400">{a}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Sumário (como a folha "Sumario" + "Anual" do Excel) ----------
function SeparadorSumario({ dash, ano }: { dash: Dashboard | null; ano: number }) {
  if (!dash) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  const contas = dash.contas;
  const linhas: { label: string; campo: keyof Conta; cor?: string }[] = [
    { label: 'Saldos', campo: 'saldoDoAno' },
    { label: 'Receitas', campo: 'receitas', cor: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Despesas', campo: 'despesas', cor: 'text-red-700 dark:text-red-400' },
    { label: 'Mov. Entrada', campo: 'entrada' },
    { label: 'Mov. Saída', campo: 'saida' },
  ];
  const totalR = dash.trimestres.reduce((s, t) => s + t.receitas, 0);
  const totalD = dash.trimestres.reduce((s, t) => s + t.despesas, 0);
  const th = 'px-3 py-2 font-medium text-right whitespace-nowrap';
  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <h2 className="text-base font-semibold p-4 pb-2">Sumário por conta — {ano}</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 text-left font-medium" />{contas.map((c) => <th key={c.id} className={th}>{c.nome}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{l.label}</td>
                {contas.map((c) => {
                  const v = c[l.campo] as number;
                  return <td key={c.id} className={`px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap ${l.campo === 'saldoDoAno' ? (v >= 0 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-red-700 dark:text-red-400 font-semibold') : l.cor ?? ''}`}>{euro(v)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground px-4 pb-3">Saldo do ano = receitas − despesas + movimentos de entrada − movimentos de saída.</p>
      </section>

      <section className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <h2 className="text-base font-semibold p-4 pb-2">Anual — {ano}</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-2 text-left font-medium" />{dash.trimestres.map((t) => <th key={t.trimestre} className={th}>{t.trimestre}</th>)}<th className={th}>Anual</th></tr></thead>
          <tbody>
            <tr className="border-b border-border"><td className="px-3 py-2 font-medium">Receitas</td>{dash.trimestres.map((t) => <td key={t.trimestre} className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{euro(t.receitas)}</td>)}<td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{euro(totalR)}</td></tr>
            <tr className="border-b border-border"><td className="px-3 py-2 font-medium">Despesas</td>{dash.trimestres.map((t) => <td key={t.trimestre} className="px-3 py-2 text-right font-mono tabular-nums text-red-700 dark:text-red-400">{euro(t.despesas)}</td>)}<td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-red-700 dark:text-red-400">{euro(totalD)}</td></tr>
            <tr><td className="px-3 py-2 font-medium">Total</td>{dash.trimestres.map((t) => <td key={t.trimestre} className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${corValor(t.receitas - t.despesas)}`}>{euro(t.receitas - t.despesas)}</td>)}<td className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${corValor(totalR - totalD)}`}>{euro(totalR - totalD)}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------- Receitas / Despesas / Mov. Internos por trimestre (como as folhas do Excel) ----------
function SeparadorLista({ ano, tipo, onAlterado }: { ano: number; tipo: 'RECEITA' | 'DESPESA' | 'INTERNO'; onAlterado: () => void }) {
  const [trimestre, setTrimestre] = useState<string>('');
  const [q, setQ] = useState('');
  const [procura, setProcura] = useState('');
  const [pagina, setPagina] = useState(1);
  const [listas, setListas] = useState<Listas>({ categorias: [], subcategorias: [], metodos: [], contas: [], anos: [] });
  const [res, setRes] = useState<{ movimentos: Movimento[]; total: number; soma: number; paginas: number } | null>(null);
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  useEffect(() => { fetch('/api/balancete/listas').then((r) => r.json()).then(setListas).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => { setProcura(q); setPagina(1); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPagina(1); }, [ano, trimestre]);
  useEffect(() => {
    const qs = new URLSearchParams({ ano: String(ano), tipo, trimestre, q: procura, pagina: String(pagina), ordem: 'data', dir: 'asc' });
    fetch(`/api/balancete/movimentos?${qs}`).then((r) => r.json()).then(setRes).catch(() => {});
  }, [ano, tipo, trimestre, procura, pagina]);

  const classificar = async (m: Movimento, campo: 'categoria' | 'subcategoria' | 'metodo' | 'fiscal', valor: string) => {
    setAGuardar(m.id);
    try {
      const r = await fetch(`/api/balancete/movimentos/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) });
      if (!r.ok) throw new Error();
      const novo = await r.json();
      setRes((s) => s && { ...s, movimentos: s.movimentos.map((x) => (x.id === m.id ? novo : x)) });
      if (campo === 'categoria') onAlterado();
    } catch {
      toast.error('Não foi possível guardar');
    } finally {
      setAGuardar(null);
    }
  };

  const titulo = tipo === 'RECEITA' ? 'Receitas' : tipo === 'DESPESA' ? 'Despesas' : 'Movimentos Internos';
  const corTotal = tipo === 'RECEITA' ? 'text-emerald-700 dark:text-emerald-400' : tipo === 'DESPESA' ? 'text-red-700 dark:text-red-400' : '';
  const sel = 'max-w-[140px] px-2 py-1 border border-input rounded text-xs bg-background text-foreground';
  const internos = tipo === 'INTERNO';

  return (
    <section className="bg-card rounded-xl border border-border shadow-sm">
      <div className="p-4 space-y-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{titulo} {trimestre || 'Anual'} · {ano}</h2>
          {internos ? <p className="text-sm text-muted-foreground">{res?.total ?? 0} movimentos</p> : <p className="text-sm">Total <span className={`font-bold font-mono tabular-nums ${corTotal}`}>{res ? euro(internos ? Math.abs(res.soma) : res.soma) : '…'}</span> <span className="text-muted-foreground">({res?.total ?? 0} movimentos)</span></p>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {['Q1', 'Q2', 'Q3', 'Q4', ''].map((t) => (
            <button key={t || 'anual'} onClick={() => setTrimestre(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${trimestre === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}>{t || 'Anual'}</button>
          ))}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por descrição…" className="w-full pl-9 pr-3 py-1.5 border border-input rounded-lg text-sm bg-background text-foreground" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-right font-medium px-3 py-2">Valor</th>
              {internos ? (
                <><th className="text-left font-medium px-3 py-2">Conta</th><th className="text-left font-medium px-3 py-2">Origem</th><th className="text-left font-medium px-3 py-2">Destino</th><th className="text-left font-medium px-3 py-2">Nota</th></>
              ) : (
                <><th className="text-left font-medium px-3 py-2">Descrição</th><th className="text-left font-medium px-3 py-2">Método</th><th className="text-left font-medium px-3 py-2">{tipo === 'DESPESA' ? 'Fonte' : 'Destino'}</th><th className="text-left font-medium px-3 py-2">Categoria</th><th className="text-left font-medium px-3 py-2">Sub-Categoria</th><th className="text-left font-medium px-3 py-2">Fiscal</th></>
              )}
            </tr>
          </thead>
          <tbody>
            {(res?.movimentos ?? []).map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatDate(m.data)}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${corValor(m.valor)}`}>{euro(m.valor)}</td>
                {internos ? (
                  <><td className="px-3 py-2 text-xs">{m.conta}</td><td className="px-3 py-2 text-xs">{m.origem ?? '—'}</td><td className="px-3 py-2 text-xs">{m.destino ?? '—'}</td><td className="px-3 py-2 text-xs text-muted-foreground">{m.nota ?? ''}</td></>
                ) : (
                  <>
                    <td className="px-3 py-2 max-w-[260px]"><div className="truncate" title={m.descricao}>{m.descricao.replace(/\s{2,}/g, ' ')}</div>{m.nota && <div className="text-[11px] text-muted-foreground truncate">{m.nota}</div>}</td>
                    <td className="px-3 py-2"><select value={m.metodo ?? ''} disabled={aGuardar === m.id} onChange={(e) => classificar(m, 'metodo', e.target.value)} className={sel}><option value="">—</option>{[...new Set([...listas.metodos, ...(m.metodo ? [m.metodo] : [])])].map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{m.conta}</td>
                    <td className="px-3 py-2"><select value={m.categoria ?? ''} disabled={aGuardar === m.id} onChange={(e) => classificar(m, 'categoria', e.target.value)} className={sel}><option value="">—</option>{[...new Set([...listas.categorias, ...(m.categoria ? [m.categoria] : [])])].map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="px-3 py-2"><select value={m.subcategoria ?? ''} disabled={aGuardar === m.id} onChange={(e) => classificar(m, 'subcategoria', e.target.value)} className={sel}><option value="">—</option>{[...new Set([...listas.subcategorias, ...(m.subcategoria ? [m.subcategoria] : [])])].map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="px-3 py-2"><input defaultValue={m.fiscal ?? ''} disabled={aGuardar === m.id} placeholder="—" onBlur={(e) => { if ((e.target.value || '') !== (m.fiscal ?? '')) classificar(m, 'fiscal', e.target.value); }} className="w-20 px-2 py-1 border border-input rounded text-xs bg-background text-foreground" /></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!res && <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {res && res.total === 0 && <p className="p-5 text-sm text-muted-foreground">Sem movimentos neste período.</p>}
      </div>
      {res && res.paginas > 1 && (
        <div className="flex items-center justify-center gap-3 p-3 border-t border-border text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)} className="p-1.5 rounded border border-input disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span>Página {pagina} de {res.paginas}</span>
          <button disabled={pagina >= res.paginas} onClick={() => setPagina((x) => x + 1)} className="p-1.5 rounded border border-input disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}
