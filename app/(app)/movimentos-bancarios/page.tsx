'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ListOrdered, Search, Download, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

type Movimento = {
  id: string;
  descricao: string;
  valor: number;
  dataMovimento: string;
  tipo: string; // 'credito' | 'debito'
  contaBancariaId: string;
  reconciliado: boolean;
  criadoPor?: string | null;
  contaBancaria?: { nome?: string };
  saldoAcumulado?: number; // computed client-side
};

type Conta = {
  id: string;
  nome: string;
  banco?: string;
  saldoInicial?: number;
  saldoAtual?: number;
  dataSaldoInicial?: string | null;
  ativa?: boolean;
};

const signed = (m: Movimento) => (m.tipo === 'credito' ? m.valor : -m.valor);

export default function MovimentosBancariosPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [contaId, setContaId] = useState<string>(''); // '' = todas
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'credito' | 'debito'>('todos');

  // Carregar contas uma vez. Por defeito mostram-se todas as contas.
  useEffect(() => {
    (async () => {
      try {
        const c: Conta[] = await fetch('/api/contas').then((x) => x.json());
        const lista = Array.isArray(c) ? c : [];
        setContas(lista);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Carregar movimentos sempre que muda a conta selecionada.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = contaId ? `/api/movimentos?contaId=${contaId}` : '/api/movimentos';
        const m: Movimento[] = await fetch(url).then((x) => x.json());
        setMovimentos(Array.isArray(m) ? m : []);
      } catch (e) {
        console.error(e);
        setMovimentos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [contaId]);

  const contaSelecionada = useMemo(() => contas.find((c) => c.id === contaId), [contas, contaId]);
  const isTodasContas = !contaId;

  // Movimentos com saldo acumulado (apenas quando ha UMA conta selecionada).
  // Ancoragem: o saldo de referencia (saldoInicial) representa o saldo do banco
  // na dataSaldoInicial. O saldo acumulado de cada linha e ancorado de forma a
  // que, no fim do dia de referencia, seja exatamente o saldo de referencia.
  const movimentosComSaldo = useMemo<Movimento[]>(() => {
    if (isTodasContas) return movimentos;
    const asc = [...movimentos].sort(
      (a, b) => new Date(a.dataMovimento).getTime() - new Date(b.dataMovimento).getTime()
    );
    const saldoRef = contaSelecionada?.saldoInicial ?? 0;
    const refDate = contaSelecionada?.dataSaldoInicial
      ? new Date(contaSelecionada.dataSaldoInicial)
      : null;

    // Soma cumulativa (assinada) e soma ate a data de referencia.
    let cum = 0;
    const cumMap = new Map<string, number>();
    let cumRef = 0;
    for (const m of asc) {
      cum += signed(m);
      cumMap.set(m.id, cum);
      if (refDate) {
        // inclui movimentos com data <= dataSaldoInicial
        if (new Date(m.dataMovimento).getTime() <= refDate.getTime()) cumRef = cum;
      }
    }
    // Se nao ha data de referencia, cumRef = 0 => saldoRef e o saldo de abertura.
    return asc.map((m) => ({
      ...m,
      saldoAcumulado: Math.round((saldoRef + (cumMap.get(m.id)! - cumRef)) * 100) / 100,
    }));
  }, [movimentos, isTodasContas, contaSelecionada]);

  // Conjunto no intervalo de datas (sem search/tipo) - base para os cartoes de resumo.
  const noIntervalo = useMemo(() => {
    const ini = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const fim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
    return movimentosComSaldo.filter((m) => {
      const d = new Date(m.dataMovimento);
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      return true;
    });
  }, [movimentosComSaldo, dataInicio, dataFim]);

  // Linhas visiveis: aplica tambem pesquisa e tipo; ordena por mais recente primeiro.
  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtradas = noIntervalo.filter((m) => {
      if (tipoFiltro !== 'todos' && m.tipo !== tipoFiltro) return false;
      if (q) {
        const conta = m.contaBancaria?.nome || '';
        if (!(`${m.descricao} ${conta}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    return filtradas.sort(
      (a, b) => new Date(b.dataMovimento).getTime() - new Date(a.dataMovimento).getTime()
    );
  }, [noIntervalo, search, tipoFiltro]);

  // Resumo (baseado no intervalo de datas, para consistencia: inicial + entradas - saidas = final).
  const resumo = useMemo(() => {
    const entradas = noIntervalo.filter((m) => m.tipo === 'credito').reduce((s, m) => s + m.valor, 0);
    const saidas = noIntervalo.filter((m) => m.tipo === 'debito').reduce((s, m) => s + m.valor, 0);
    // ordena o intervalo por data asc para inicial/final
    const asc = [...noIntervalo].sort(
      (a, b) => new Date(a.dataMovimento).getTime() - new Date(b.dataMovimento).getTime()
    );
    let saldoInicial: number | null = null;
    let saldoFinal: number | null = null;
    if (!isTodasContas && asc.length > 0) {
      const primeiro = asc[0];
      const ultimo = asc[asc.length - 1];
      saldoInicial = Math.round(((primeiro.saldoAcumulado ?? 0) - signed(primeiro)) * 100) / 100;
      saldoFinal = ultimo.saldoAcumulado ?? null;
    }
    return {
      entradas: Math.round(entradas * 100) / 100,
      saidas: Math.round(saidas * 100) / 100,
      liquido: Math.round((entradas - saidas) * 100) / 100,
      saldoInicial,
      saldoFinal,
      total: noIntervalo.length,
    };
  }, [noIntervalo, isTodasContas]);

  // Atalhos de periodo
  const aplicarPeriodo = (tipo: 'mesAtual' | 'mesAnterior' | 'anoAtual' | 'tudo') => {
    const hoje = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    if (tipo === 'tudo') {
      setDataInicio('');
      setDataFim('');
    } else if (tipo === 'mesAtual') {
      setDataInicio(fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setDataFim(fmt(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
    } else if (tipo === 'mesAnterior') {
      setDataInicio(fmt(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)));
      setDataFim(fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 0)));
    } else if (tipo === 'anoAtual') {
      setDataInicio(fmt(new Date(hoje.getFullYear(), 0, 1)));
      setDataFim(fmt(new Date(hoje.getFullYear(), 11, 31)));
    }
  };

  const exportarExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = visiveis.map((m) => {
        const row: any = {
          Data: formatDate(m.dataMovimento),
          Descricao: m.descricao,
          Conta: m.contaBancaria?.nome || '',
          'Entrada (EUR)': m.tipo === 'credito' ? m.valor : '',
          'Saida (EUR)': m.tipo === 'debito' ? m.valor : '',
        };
        if (!isTodasContas) row['Saldo acumulado (EUR)'] = m.saldoAcumulado ?? '';
        row['Estado'] = m.reconciliado ? 'Reconciliado' : 'Por reconciliar';
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const nomeConta = isTodasContas ? 'Todas' : (contaSelecionada?.nome || 'Conta').slice(0, 25);
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentos');
      const hoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `movimentos_${nomeConta}_${hoje}.xlsx`.replace(/\s+/g, '_'));
      toast.success('Exportacao concluida');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListOrdered}
        title="Movimentos Bancarios"
        description="Extrato de consulta com saldo acumulado linha a linha"
        action={
          <button
            onClick={exportarExcel}
            disabled={visiveis.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        }
      />

      {/* Filtros */}
      <div className="bg-card rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Conta</label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
            >
              <option value="">Todas as contas</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` - ${c.banco}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Data inicio</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Data fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as any)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
            >
              <option value="todos">Todos</option>
              <option value="credito">Entradas</option>
              <option value="debito">Saidas</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => aplicarPeriodo('mesAtual')} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/70 font-medium">Mes atual</button>
            <button onClick={() => aplicarPeriodo('mesAnterior')} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/70 font-medium">Mes anterior</button>
            <button onClick={() => aplicarPeriodo('anoAtual')} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/70 font-medium">Ano atual</button>
            <button onClick={() => aplicarPeriodo('tudo')} className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/70 font-medium">Tudo</button>
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar descricao..."
              className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className={`grid grid-cols-2 ${isTodasContas ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
        {!isTodasContas && (
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Wallet className="h-3.5 w-3.5" />Saldo inicial</div>
            <p className="text-lg font-bold font-mono">{resumo.saldoInicial != null ? formatCurrency(resumo.saldoInicial) : '-'}</p>
          </div>
        )}
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />Total entradas</div>
          <p className="text-lg font-bold font-mono text-emerald-700">{formatCurrency(resumo.entradas)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />Total saidas</div>
          <p className="text-lg font-bold font-mono text-red-700">{formatCurrency(resumo.saidas)}</p>
        </div>
        {!isTodasContas ? (
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><TrendingUp className="h-3.5 w-3.5" />Saldo final</div>
            <p className="text-lg font-bold font-mono">{resumo.saldoFinal != null ? formatCurrency(resumo.saldoFinal) : '-'}</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><TrendingUp className="h-3.5 w-3.5" />Variacao liquida</div>
            <p className={`text-lg font-bold font-mono ${resumo.liquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(resumo.liquido)}</p>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {visiveis.length} movimento{visiveis.length === 1 ? '' : 's'}
            {isTodasContas && <span className="text-muted-foreground font-normal"> - saldo acumulado oculto (todas as contas)</span>}
          </h2>
        </div>
        {loading ? (
          <div className="h-64 bg-muted animate-pulse" />
        ) : visiveis.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={ListOrdered} title="Sem movimentos" description="Nao existem movimentos para os filtros selecionados." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Descricao</th>
                  {isTodasContas && <th className="px-4 py-2.5 font-medium">Conta</th>}
                  <th className="px-4 py-2.5 font-medium text-right">Entrada</th>
                  <th className="px-4 py-2.5 font-medium text-right">Saida</th>
                  {!isTodasContas && <th className="px-4 py-2.5 font-medium text-right">Saldo acumulado</th>}
                  <th className="px-4 py-2.5 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((m, idx) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(m.dataMovimento)}</td>
                    <td className="px-4 py-2.5 max-w-[320px]"><div className="truncate" title={m.descricao}>{m.descricao}</div>{m.criadoPor && <span className="block text-[11px] text-muted-foreground/70">Registado por {m.criadoPor}</span>}</td>
                    {isTodasContas && <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{m.contaBancaria?.nome || '-'}</td>}
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{m.tipo === 'credito' ? formatCurrency(m.valor) : ''}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-700">{m.tipo === 'debito' ? formatCurrency(m.valor) : ''}</td>
                    {!isTodasContas && <td className="px-4 py-2.5 text-right font-mono font-semibold">{m.saldoAcumulado != null ? formatCurrency(m.saldoAcumulado) : ''}</td>}
                    <td className="px-4 py-2.5 text-center">
                      {m.reconciliado ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Reconciliado</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Por reconciliar</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isTodasContas && contaSelecionada?.dataSaldoInicial && (
        <p className="text-xs text-muted-foreground">
          Saldo acumulado ancorado no saldo de referencia de {formatCurrency(contaSelecionada.saldoInicial ?? 0)} em {formatDate(contaSelecionada.dataSaldoInicial)}.
        </p>
      )}
    </div>
  );
}
