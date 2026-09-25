'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Plus, Check, X, Link2, Loader2, Zap, CheckCircle2, FileText, Search, ListFilter, Undo2, AlertTriangle, ArrowRight, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

export default function ReconciliacaoPage() {
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [faturasPendentes, setFaturasPendentes] = useState<any[]>([]);
  const [faturasClientes, setFaturasClientes] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [despesasPend, setDespesasPend] = useState<any[]>([]);
  const [vencimentosPend, setVencimentosPend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMov, setShowAddMov] = useState(false);
  const [selectedMov, setSelectedMov] = useState<any>(null);
  const [selectedContaFilter, setSelectedContaFilter] = useState('');
  // Lado direito: por defeito só aparece o que corresponde ao movimento escolhido.
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [procuraRec, setProcuraRec] = useState('');
  const escolherMovimento = (m: any) => { setSelectedMov(m); setMostrarTodos(false); setProcuraRec(''); };
  // Modo de reconciliação: por movimento (clássico) ou por fatura (escolhe fatura e sugere movimento)
  const [modo, setModo] = useState<'movimento' | 'fatura'>('movimento');
  const [selectedFatura, setSelectedFatura] = useState<any>(null);
  const [faturaSearch, setFaturaSearch] = useState('');
  const [movForm, setMovForm] = useState({ descricao: '', valor: '', dataMovimento: '', tipo: 'credito', contaBancariaId: '' });

  // Auto reconciliation states
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoMatches, setAutoMatches] = useState<any[]>([]);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [selectedAutoMatches, setSelectedAutoMatches] = useState<Record<number, boolean>>({});

  const load = async () => {
    try {
      const url = selectedContaFilter ? `/api/movimentos?contaId=${selectedContaFilter}` : '/api/movimentos';
      const [m, r, p, c, fp, fc, outros] = await Promise.all([
        fetch(url).then((x) => x.json()),
        fetch('/api/recebimentos').then((x) => x.json()),
        fetch('/api/pagamentos').then((x) => x.json()),
        fetch('/api/contas').then((x) => x.json()),
        fetch('/api/faturas/pendentes').then((x) => x.json()),
        fetch('/api/faturas/pendentes?tipo=emitida').then((x) => x.json()),
        fetch('/api/reconciliacao/outros').then((x) => x.json()).catch(() => ({})),
      ]);
      setDespesasPend(Array.isArray(outros?.despesas) ? outros.despesas : []);
      setVencimentosPend(Array.isArray(outros?.vencimentos) ? outros.vencimentos : []);
      setMovimentos(m ?? []); setRecebimentos((r ?? []).filter((x: any) => !x?.reconciliado)); setPagamentos((p ?? []).filter((x: any) => !x?.reconciliado)); setFaturasPendentes(Array.isArray(fp) ? fp : []); setFaturasClientes(Array.isArray(fc) ? fc : []); setContas(c ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selectedContaFilter]);

  const handleAddMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/movimentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movForm) });
      if (!res.ok) { toast.error('Erro ao criar movimento'); return; }
      toast.success('Movimento criado'); setShowAddMov(false); load();
    } catch { toast.error('Erro'); }
  };

  const handleReconciliar = async (movimentoId: string, recebimentoId: string | null, pagamentoId: string | null) => {
    try {
      const res = await fetch('/api/reconciliacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimentoId, recebimentoId, pagamentoId }) });
      if (!res.ok) { toast.error('Erro na reconciliação'); return; }
      toast.success('Reconciliação efetuada!'); setSelectedMov(null); load();
    } catch { toast.error('Erro'); }
  };

  const [desfazerBusy, setDesfazerBusy] = useState<string | null>(null);
  const handleReconciliarOutro = async (movimentoId: string, alvo: { despesaId?: string; vencimentoId?: string }) => {
    try {
      const res = await fetch('/api/reconciliacao/outros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimentoId, ...alvo }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error || 'Erro na reconciliação'); return; }
      toast.success(alvo.despesaId ? 'Movimento reconciliado com a despesa!' : 'Movimento reconciliado com o vencimento!'); setSelectedMov(null); load();
    } catch { toast.error('Erro na reconciliação'); }
  };

  const handleDesfazer = async (movimentoId: string) => {
    if (!confirm('Anular esta reconciliação?\n\nO movimento volta a ficar por reconciliar. Se a reconciliação tiver sido feita por fatura, o pagamento/recebimento criado automaticamente será apagado e o saldo da conta reposto.')) return;
    setDesfazerBusy(movimentoId);
    try {
      const res = await fetch('/api/reconciliacao/desfazer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimentoId }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error || 'Erro ao anular'); return; }
      toast.success('Reconciliação anulada'); load();
    } catch { toast.error('Erro ao anular a reconciliação'); }
    finally { setDesfazerBusy(null); }
  };

  const handleReconciliarComFatura = async (movimentoId: string, faturaId: string, tipoFatura: 'fornecedor' | 'cliente' = 'fornecedor') => {
    try {
      const endpoint = tipoFatura === 'cliente' ? '/api/reconciliacao/fatura-cliente' : '/api/reconciliacao/fatura';
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimentoId, faturaId }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error || 'Erro na reconciliação'); return; }
      toast.success(`Movimento reconciliado com fatura de ${tipoFatura}!`); setSelectedMov(null); load();
    } catch { toast.error('Erro na reconciliação'); }
  };

  // Auto Reconciliation
  const handleAutoReconciliation = async () => {
    setAutoRunning(true);
    try {
      const res = await fetch('/api/reconciliacao/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contaBancariaId: selectedContaFilter || undefined }),
      });
      const data = await res.json();
      if (data?.success) {
        if (data.matches.length === 0) {
          toast.info('Nenhuma correspondência encontrada');
        } else {
          setAutoMatches(data.matches);
          const preSelected: Record<number, boolean> = {};
          data.matches.forEach((m: any, i: number) => {
            if (m.confidence === 'alta') preSelected[i] = true;
          });
          setSelectedAutoMatches(preSelected);
          setShowAutoModal(true);
          toast.success(`${data.matches.length} correspondência(s) encontrada(s)`);
        }
      } else {
        toast.error(data?.error || 'Erro');
      }
    } catch { toast.error('Erro na reconciliação automática'); } finally { setAutoRunning(false); }
  };

  const handleApplyAutoMatches = async () => {
    const selected = autoMatches.filter((_, i) => selectedAutoMatches[i]);
    if (selected.length === 0) { toast.error('Selecione pelo menos uma correspondência'); return; }
    setAutoRunning(true);
    try {
      const res = await fetch('/api/reconciliacao/auto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: selected }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(`${data.applied} reconciliação(ões) aplicada(s)`);
        setShowAutoModal(false); setAutoMatches([]); load();
      } else {
        toast.error(data?.error || 'Erro');
      }
    } catch { toast.error('Erro'); } finally { setAutoRunning(false); }
  };

  const getMovDesc = (id: string) => movimentos.find((m: any) => m.id === id);
  const getPagDesc = (id: string) => pagamentos.find((p: any) => p.id === id) || { descricao: 'Pagamento', valor: 0 };
  const getRecDesc = (id: string) => recebimentos.find((r: any) => r.id === id) || { descricao: 'Recebimento', valor: 0 };
  const getFatDesc = (id: string) => faturasPendentes.find((f: any) => f.id === id) || faturasClientes.find((f: any) => f.id === id);

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  const movimentosNaoReconciliados = (movimentos ?? []).filter((m: any) => !m?.reconciliado);

  // ---- Modo "por movimento": sugestões para o movimento selecionado ----
  // Palavras úteis da descrição do banco (ex.: "COMPRA SHOPIFY* 593167089" → shopify, 593167089).
  const PALAVRAS_BANCO = new Set(['compra', 'trf', 'ips', 'sepa', 'pag', 'pagamento', 'serv', 'com', 'estr', 'lda', 'unip', 'way', 'debito', 'credito', 'transf']);
  const palavrasMov = String(selectedMov?.descricao || '').toLowerCase().split(/[^a-z0-9à-ú]+/i)
    .filter((p) => p.length >= 3 && !PALAVRAS_BANCO.has(p));
  const semelhancaNome = (texto: string) => {
    const t = texto.toLowerCase();
    return palavrasMov.reduce((n, p) => n + (t.includes(p) ? 1 : 0), 0);
  };
  const pq = procuraRec.trim().toLowerCase();
  // Devolve a lista a mostrar e quantos têm o valor exato do movimento.
  // Sem pesquisa nem "mostrar todos": só os de valor igual; se não houver nenhum,
  // os que coincidem no nome (ex.: fatura com valor diferente por câmbio ou comissão).
  const sugerir = (lista: any[], valorDe: (x: any) => number, dataDe: (x: any) => any, textoDe: (x: any) => string) => {
    const alvo = Number(selectedMov?.valor || 0);
    const tMov = selectedMov?.dataMovimento ? new Date(selectedMov.dataMovimento).getTime() : 0;
    const itens = (lista ?? []).map((x: any) => {
      const texto = textoDe(x);
      return {
        x,
        texto,
        igual: Math.abs((valorDe(x) || 0) - alvo) < 0.01,
        nome: semelhancaNome(texto),
        dias: dataDe(x) ? Math.abs(new Date(dataDe(x)).getTime() - tMov) / 86400000 : 99999,
      };
    }).sort((a, b) => (Number(b.igual) - Number(a.igual)) || (b.nome - a.nome) || (a.dias - b.dias));
    const iguais = itens.filter((i) => i.igual).length;
    let visiveis = itens;
    if (pq) visiveis = itens.filter((i) => i.texto.toLowerCase().includes(pq));
    else if (!mostrarTodos) visiveis = iguais > 0 ? itens.filter((i) => i.igual) : itens.filter((i) => i.nome > 0).slice(0, 5);
    return { itens: visiveis.map((i) => i.x), iguais, total: itens.length };
  };
  const textoFatura = (f: any) => `${f?.numero || ''} ${f?.cliente?.nome || f?.fornecedor?.nome || f?.entidadeNome || ''} ${f?.descricao || ''} ${f?.saldoPendente ?? f?.valor ?? ''}`;
  const sugFatCli = sugerir(faturasClientes, (f) => f?.saldoPendente ?? f?.valor, (f) => f?.dataEmissao, textoFatura);
  const sugRec = sugerir(recebimentos, (r) => r?.valor, (r) => r?.dataRecebimento, (r) => `${r?.descricao || ''} ${r?.valor ?? ''}`);
  const sugFatForn = sugerir(faturasPendentes, (f) => f?.saldoPendente ?? f?.valor, (f) => f?.dataEmissao, textoFatura);
  const sugPag = sugerir(pagamentos, (p) => p?.valor, (p) => p?.dataPagamento, (p) => `${p?.descricao || ''} ${p?.fatura?.numero || ''} ${p?.valor ?? ''}`);
  const sugDesp = sugerir(despesasPend, (d) => d?.valor, (d) => d?.data, (d) => `${d?.descricao || ''} ${d?.fornecedor?.nome || d?.entidadeNome || ''} ${d?.categoria || ''} ${d?.valor ?? ''}`);
  const valorVencimento = (v: any) => v?.valorLiquido ?? v?.valorBruto;
  const sugVenc = sugerir(vencimentosPend, valorVencimento, (v) => v?.dataPagamento || (v?.periodo ? `${v.periodo}-28` : null), (v) => `${v?.funcionario || ''} vencimento ${v?.periodo || ''} ${valorVencimento(v) ?? ''}`);
  const sugestoesMov = selectedMov?.tipo === 'credito' ? [sugFatCli, sugRec] : [sugFatForn, sugPag, sugDesp, sugVenc];
  const totalIguais = sugestoesMov.reduce((n, x) => n + x.iguais, 0);
  const totalVisiveis = sugestoesMov.reduce((n, x) => n + x.itens.length, 0);
  const totalGeral = sugestoesMov.reduce((n, x) => n + x.total, 0);
  const vazioFiltrado = (texto: string) => <p className="text-xs text-muted-foreground">{pq ? 'Nada encontrado com essa pesquisa' : mostrarTodos ? texto : 'Nenhum com o mesmo valor'}</p>;

  // ---- Modo "por fatura": lista combinada de faturas pendentes ----
  const faturasCombinadas = [
    ...(faturasClientes ?? []).map((f: any) => ({ ...f, __tf: 'cliente' as const })),
    ...(faturasPendentes ?? []).map((f: any) => ({ ...f, __tf: 'fornecedor' as const })),
  ];
  const fq = faturaSearch.trim().toLowerCase();
  const faturasFiltradas = faturasCombinadas.filter((f: any) => {
    if (!fq) return true;
    const ent = f?.cliente?.nome || f?.fornecedor?.nome || f?.entidadeNome || '';
    return `${f?.numero || ''} ${ent} ${f?.descricao || ''}`.toLowerCase().includes(fq);
  });

  // Movimentos sugeridos para a fatura selecionada, ordenados por proximidade
  // de valor e depois de data (emissão vs. data do movimento).
  const candidatosParaFatura = (() => {
    if (!selectedFatura) return [] as any[];
    const wantTipo = selectedFatura.__tf === 'cliente' ? 'credito' : 'debito';
    const alvo = selectedFatura.saldoPendente ?? selectedFatura.valor ?? 0;
    const emissao = selectedFatura.dataEmissao ? new Date(selectedFatura.dataEmissao).getTime() : null;
    return movimentosNaoReconciliados
      .filter((m: any) => m?.tipo === wantTipo)
      .map((m: any) => {
        const diffValor = Math.abs((m?.valor || 0) - alvo);
        const diffDias = emissao ? Math.abs(new Date(m?.dataMovimento).getTime() - emissao) / 86400000 : 99999;
        return { ...m, __diffValor: diffValor, __valorMatch: diffValor < 0.01, __diffDias: diffDias };
      })
      .sort((a: any, b: any) => (a.__diffValor - b.__diffValor) || (a.__diffDias - b.__diffDias))
      .slice(0, 25);
  })();

  return (
    <div className="space-y-6">
      <PageHeader icon={RefreshCcw} title="Reconciliação Bancária" description="Associar movimentos bancários a recebimentos e pagamentos" action={
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-input overflow-hidden text-sm">
            <button onClick={() => { setModo('movimento'); setSelectedFatura(null); }} className={`px-3 py-2 font-medium transition-colors ${modo === 'movimento' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>Por movimento</button>
            <button onClick={() => { setModo('fatura'); setSelectedMov(null); }} className={`px-3 py-2 font-medium transition-colors ${modo === 'fatura' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>Por fatura</button>
          </div>
          <select value={selectedContaFilter} onChange={(e) => setSelectedContaFilter(e.target.value)} className="px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"><option value="">Todas as contas</option>{(contas ?? []).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome}</option>)}</select>
          <button onClick={handleAutoReconciliation} disabled={autoRunning} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {autoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Auto-Reconciliar
          </button>
          <button onClick={() => { setMovForm({ descricao: '', valor: '', dataMovimento: '', tipo: 'credito', contaBancariaId: '' }); setShowAddMov(true); }} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" />Movimento</button>
        </div>
      } />

      {modo === 'movimento' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Movimentos Bancários ({movimentosNaoReconciliados?.length ?? 0} por reconciliar)</h2>
          {(movimentosNaoReconciliados?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Todos os movimentos estão reconciliados.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {movimentosNaoReconciliados.map((m: any) => (
                <div key={m?.id} onClick={() => escolherMovimento(m)} className={`p-3 rounded-lg cursor-pointer transition-all ${selectedMov?.id === m?.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/30 hover:bg-muted/50'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{m?.descricao}</p>
                      <p className="text-xs text-muted-foreground">{m?.contaBancaria?.nome} • {formatDate(m?.dataMovimento)}</p>
                    </div>
                    <p className={`font-mono font-bold text-sm ${m?.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m?.tipo === 'credito' ? '+' : '-'}{formatCurrency(m?.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {selectedMov ? 'Selecione para reconciliar' : 'Selecione um movimento'}
          </h2>
          {!selectedMov ? (
            <p className="text-sm text-muted-foreground py-4">Clique num movimento bancário à esquerda para iniciar a reconciliação.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{selectedMov?.descricao}</span>{' '}
                  <span className={`font-mono font-bold ${selectedMov?.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>{selectedMov?.tipo === 'credito' ? '+' : '-'}{formatCurrency(selectedMov?.valor)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {pq ? `${totalVisiveis} resultado(s) da pesquisa`
                    : mostrarTodos ? `A mostrar todos os ${totalGeral} pendentes (os de valor igual primeiro)`
                    : totalIguais > 0 ? `${totalIguais} com o mesmo valor (${formatCurrency(selectedMov?.valor)})`
                    : totalVisiveis > 0 ? 'Nenhum com o mesmo valor; sugestões pelo nome'
                    : 'Nenhum pendente com o mesmo valor ou nome'}
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={procuraRec} onChange={(e) => setProcuraRec(e.target.value)} placeholder="Procurar número, entidade, valor..." className="w-full pl-8 pr-2 py-1.5 border border-input rounded-lg text-xs bg-background text-foreground" />
                  </div>
                  <button onClick={() => setMostrarTodos((v) => !v)} className="flex items-center gap-1 px-3 py-1.5 border border-input rounded-lg text-xs font-medium bg-background hover:bg-muted shrink-0">
                    <ListFilter className="h-3.5 w-3.5" />{mostrarTodos ? 'Só correspondentes' : `Mostrar todos (${totalGeral})`}
                  </button>
                </div>
              </div>
              {selectedMov?.tipo === 'credito' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-blue-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Faturas de Clientes Pendentes</h3>
                    {sugFatCli.itens.length === 0 ? vazioFiltrado('Sem faturas de clientes pendentes') : (
                      <div className="space-y-2">
                        {sugFatCli.itens.map((f: any) => {
                          const valorMatch = Math.abs((f?.saldoPendente ?? f?.valor ?? 0) - (selectedMov?.valor || 0)) < 0.01;
                          return (
                            <div key={f?.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${valorMatch ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'bg-muted/30 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{f?.numero || 'S/N'}</p>
                                  {valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 rounded font-medium">Valor coincide</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">{f?.cliente?.nome || f?.entidadeNome || 'Cliente'} • {formatCurrency(f?.saldoPendente ?? f?.valor)} pendente{f?.dataEmissao ? ` • ${formatDate(f.dataEmissao)}` : ''}</p>
                                {f?.descricao && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{f.descricao}</p>}
                              </div>
                              <button onClick={() => handleReconciliarComFatura(selectedMov?.id, f?.id, 'cliente')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0"><Link2 className="h-3 w-3" />Conciliar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-emerald-700">Recebimentos pendentes</h3>
                    {sugRec.itens.length === 0 ? vazioFiltrado('Sem recebimentos pendentes') : (
                      <div className="space-y-2">
                        {sugRec.itens.map((r: any) => (
                          <div key={r?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <div><p className="text-sm font-medium">{r?.descricao}</p><p className="text-xs text-muted-foreground">{formatCurrency(r?.valor)} • {formatDate(r?.dataRecebimento)}</p></div>
                            <button onClick={() => handleReconciliar(selectedMov?.id, r?.id, null)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"><Link2 className="h-3 w-3" />Reconciliar</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedMov?.tipo === 'debito' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-amber-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Faturas de Fornecedor Pendentes</h3>
                    {sugFatForn.itens.length === 0 ? vazioFiltrado('Sem faturas pendentes') : (
                      <div className="space-y-2">
                        {sugFatForn.itens.map((f: any) => {
                          const valorMatch = Math.abs((f?.saldoPendente ?? f?.valor ?? 0) - (selectedMov?.valor || 0)) < 0.01;
                          return (
                            <div key={f?.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${valorMatch ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300' : 'bg-muted/30 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{f?.numero || 'S/N'}</p>
                                  {valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 rounded font-medium">Valor coincide</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">{f?.fornecedor?.nome || f?.entidadeNome || 'Fornecedor'} • {formatCurrency(f?.saldoPendente ?? f?.valor)} pendente{f?.dataEmissao ? ` • ${formatDate(f.dataEmissao)}` : ''}</p>
                                {f?.descricao && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{f.descricao}</p>}
                              </div>
                              <button onClick={() => handleReconciliarComFatura(selectedMov?.id, f?.id)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 shrink-0"><Link2 className="h-3 w-3" />Conciliar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-purple-700 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" />Vencimentos</h3>
                    {sugVenc.itens.length === 0 ? vazioFiltrado('Sem vencimentos por reconciliar') : (
                      <div className="space-y-2">
                        {sugVenc.itens.map((v: any) => {
                          const valorMatch = Math.abs((valorVencimento(v) || 0) - (selectedMov?.valor || 0)) < 0.01;
                          return (
                            <div key={v?.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${valorMatch ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-300' : 'bg-muted/30 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{v?.funcionario}</p>
                                  {valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200 rounded font-medium">Valor coincide</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">Vencimento {v?.periodo || ''} • {formatCurrency(valorVencimento(v))} líquido • {v?.estado === 'pago' ? 'pago' : 'pendente'}</p>
                              </div>
                              <button onClick={() => handleReconciliarOutro(selectedMov?.id, { vencimentoId: v?.id })} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 shrink-0"><Link2 className="h-3 w-3" />Conciliar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-orange-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Despesas</h3>
                    {sugDesp.itens.length === 0 ? vazioFiltrado('Sem despesas por reconciliar') : (
                      <div className="space-y-2">
                        {sugDesp.itens.map((d: any) => {
                          const valorMatch = Math.abs((d?.valor || 0) - (selectedMov?.valor || 0)) < 0.01;
                          return (
                            <div key={d?.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${valorMatch ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-300' : 'bg-muted/30 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate max-w-[260px]">{d?.descricao}</p>
                                  {valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200 rounded font-medium">Valor coincide</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">{d?.fornecedor?.nome || d?.entidadeNome || d?.categoria || 'Despesa'} • {formatCurrency(d?.valor)} • {formatDate(d?.data)}{d?.estado === 'pago' ? ' • paga' : ''}</p>
                              </div>
                              <button onClick={() => handleReconciliarOutro(selectedMov?.id, { despesaId: d?.id })} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 shrink-0"><Link2 className="h-3 w-3" />Conciliar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-red-700">Pagamentos pendentes</h3>
                    {sugPag.itens.length === 0 ? vazioFiltrado('Sem pagamentos pendentes') : (
                      <div className="space-y-2">
                        {sugPag.itens.map((p: any) => (
                          <div key={p?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <div><p className="text-sm font-medium">{p?.descricao}</p><p className="text-xs text-muted-foreground">{formatCurrency(p?.valor)} • {formatDate(p?.dataPagamento)}{p?.fatura?.numero ? ` • Fatura: ${p.fatura.numero}` : ''}</p></div>
                            <button onClick={() => handleReconciliar(selectedMov?.id, null, p?.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"><Link2 className="h-3 w-3" />Reconciliar</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {modo === 'fatura' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda: escolher fatura */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><FileText className="h-5 w-5" />Faturas pendentes ({faturasCombinadas.length})</h2>
          <p className="text-xs text-muted-foreground mb-3">Escolha a fatura e sugerimos um movimento por reconciliar para validar.</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={faturaSearch} onChange={(e) => setFaturaSearch(e.target.value)} placeholder="Pesquisar fatura, entidade..." className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground" />
          </div>
          {faturasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem faturas pendentes.</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {faturasFiltradas.map((f: any) => {
                const ent = f?.cliente?.nome || f?.fornecedor?.nome || f?.entidadeNome || (f.__tf === 'cliente' ? 'Cliente' : 'Fornecedor');
                const isCliente = f.__tf === 'cliente';
                return (
                  <div key={`${f.__tf}-${f?.id}`} onClick={() => setSelectedFatura(f)} className={`p-3 rounded-lg cursor-pointer transition-all ${selectedFatura?.id === f?.id && selectedFatura?.__tf === f.__tf ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/30 hover:bg-muted/50'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{f?.numero || 'S/N'}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isCliente ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{isCliente ? 'Cliente' : 'Fornecedor'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{ent}{f?.dataEmissao ? ` • ${formatDate(f.dataEmissao)}` : ''}</p>
                      </div>
                      <p className="font-mono font-bold text-sm shrink-0">{formatCurrency(f?.saldoPendente ?? f?.valor)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna direita: movimento sugerido */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{selectedFatura ? 'Movimento sugerido' : 'Selecione uma fatura'}</h2>
          {!selectedFatura ? (
            <p className="text-sm text-muted-foreground py-4">Clique numa fatura à esquerda para encontrarmos um movimento bancário por reconciliar que corresponda.</p>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Fatura {selectedFatura?.numero || 'S/N'} • {selectedFatura?.__tf === 'cliente' ? 'Cliente' : 'Fornecedor'}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedFatura?.cliente?.nome || selectedFatura?.fornecedor?.nome || selectedFatura?.entidadeNome || ''}</p>
                </div>
                <p className="font-mono font-bold text-sm shrink-0">{formatCurrency(selectedFatura?.saldoPendente ?? selectedFatura?.valor)}</p>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ListFilter className="h-3.5 w-3.5" />Movimentos {selectedFatura?.__tf === 'cliente' ? 'de crédito (entradas)' : 'de débito (saídas)'} por reconciliar, ordenados por semelhança.</p>
              {candidatosParaFatura.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum movimento por reconciliar compatível encontrado.</p>
              ) : (
                <div className="space-y-2 max-h-[440px] overflow-y-auto">
                  {candidatosParaFatura.map((m: any, i: number) => (
                    <div key={m?.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${m.__valorMatch ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-300' : 'bg-muted/30 hover:bg-muted/50'}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{m?.descricao}</p>
                          {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded font-medium shrink-0">Melhor sugestão</span>}
                          {m.__valorMatch && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded font-medium shrink-0">Valor coincide</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{m?.contaBancaria?.nome} • {formatDate(m?.dataMovimento)}{!m.__valorMatch ? ` • dif. ${formatCurrency(m.__diffValor)}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={`font-mono font-bold text-sm ${m?.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>{m?.tipo === 'credito' ? '+' : '-'}{formatCurrency(m?.valor)}</p>
                        <button onClick={() => { handleReconciliarComFatura(m?.id, selectedFatura?.id, selectedFatura?.__tf); setSelectedFatura(null); }} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"><Link2 className="h-3 w-3" />Conciliar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {(movimentos ?? []).some((m: any) => m?.reconciliado) && (
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><Check className="h-5 w-5 text-emerald-600" />Movimentos Reconciliados</h2>
          <p className="text-xs text-muted-foreground mb-4">Verifique a que documento cada movimento ficou ligado. Se algo estiver errado, use "Desfazer" para corrigir.</p>
          <div className="space-y-3">
            {(movimentos ?? []).filter((m: any) => m?.reconciliado).map((m: any) => {
              const doc = m?.recebimento || m?.pagamento || null;
              const isRecebimento = !!m?.recebimento;
              const docValor = doc?.valor;
              const docData = doc ? (isRecebimento ? doc?.dataRecebimento : doc?.dataPagamento) : null;
              const docEntidade = doc ? (isRecebimento ? doc?.cliente?.nome : doc?.fornecedor?.nome) : null;
              const docFatura = doc?.fatura || null;
              const valorMatch = doc && docValor != null && Math.abs(Number(m?.valor) - Number(docValor)) < 0.01;
              return (
                <div key={m?.id} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m?.descricao}</p>
                      <p className="text-xs text-muted-foreground">{m?.contaBancaria?.nome} • {formatDate(m?.dataMovimento)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-mono font-bold text-sm ${m?.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>{m?.tipo === 'credito' ? '+' : '-'}{formatCurrency(m?.valor)}</p>
                      <button onClick={() => handleDesfazer(m?.id)} disabled={desfazerBusy === m?.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-900/20"><Undo2 className="h-3.5 w-3.5" />{desfazerBusy === m?.id ? 'A desfazer...' : 'Desfazer'}</button>
                    </div>
                  </div>
                  {doc ? (
                    <div className="mt-2 pl-3 border-l-2 border-emerald-300 dark:border-emerald-800">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>Ligado a {isRecebimento ? 'recebimento' : 'pagamento'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm truncate flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{doc?.descricao || (isRecebimento ? 'Recebimento' : 'Pagamento')}</p>
                          <p className="text-xs text-muted-foreground">{docEntidade ? `${docEntidade} • ` : ''}{docData ? formatDate(docData) : 'sem data'}{docFatura ? ` • Fatura ${docFatura?.numero || docFatura?.entidadeNome || ''}` : ''}</p>
                        </div>
                        {docValor != null && (
                          <p className="font-mono font-bold text-sm shrink-0">{formatCurrency(docValor)}</p>
                        )}
                      </div>
                      {docValor != null && (
                        valorMatch ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded"><CheckCircle2 className="h-3.5 w-3.5" />Valores coincidem — conciliação correta</div>
                        ) : (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded"><AlertTriangle className="h-3.5 w-3.5" />Valores diferentes (dif. {formatCurrency(Math.abs(Number(m?.valor) - Number(docValor)))}) — verifique</div>
                        )
                      )}
                    </div>
                  ) : m?.despesa || m?.vencimento ? (
                    <div className="mt-2 pl-3 border-l-2 border-emerald-300 dark:border-emerald-800">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>Ligado a {m?.despesa ? 'despesa' : 'vencimento'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm truncate flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {m?.despesa ? `${m.despesa.descricao}${m.despesa.entidadeNome ? ` • ${m.despesa.entidadeNome}` : ''}` : `${m.vencimento.funcionario}${m.vencimento.periodo ? ` • ${m.vencimento.periodo}` : ''}`}
                        </p>
                        {m?.despesa && <p className="font-mono font-bold text-sm shrink-0">{formatCurrency(m.despesa.valor)}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded"><AlertTriangle className="h-3.5 w-3.5" />Reconciliado mas sem documento associado — recomenda-se desfazer</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Movement Modal */}
      {showAddMov && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddMov(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Novo Movimento Bancário</h2><button onClick={() => setShowAddMov(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleAddMovimento} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Descrição *</label><input value={movForm.descricao} onChange={(e) => setMovForm({ ...movForm, descricao: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Valor (€) *</label><input type="number" step="0.01" value={movForm.valor} onChange={(e) => setMovForm({ ...movForm, valor: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
                <div><label className="block text-sm font-medium mb-1">Data *</label><input type="date" value={movForm.dataMovimento} onChange={(e) => setMovForm({ ...movForm, dataMovimento: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Tipo *</label><select value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"><option value="credito">Crédito</option><option value="debito">Débito</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Conta *</label><select value={movForm.contaBancariaId} onChange={(e) => setMovForm({ ...movForm, contaBancariaId: e.target.value })} className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground" required><option value="">Selecione</option>{(contas ?? []).filter((c: any) => c?.ativa).map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome}</option>)}</select></div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90">Criar Movimento</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Auto Reconciliation Modal */}
      <AnimatePresence>
        {showAutoModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAutoModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-600" />Reconciliação Automática</h2>
                <button onClick={() => setShowAutoModal(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">Correspondências encontradas por valor e data. Confirme as que pretende aplicar.</p>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {autoMatches.map((match, i) => {
                  const mov = getMovDesc(match.movimentoId);
                  const isFaturaCliente = !!match.faturaClienteId;
                  const isFatura = !!match.faturaId && !isFaturaCliente;
                  const isPag = !!match.pagamentoId;
                  const fat = (isFatura || isFaturaCliente) ? getFatDesc(match.faturaClienteId || match.faturaId) : null;
                  const target = (isFatura || isFaturaCliente) ? fat : (isPag ? getPagDesc(match.pagamentoId) : getRecDesc(match.recebimentoId));
                  const typeLabel = isFaturaCliente ? 'Crédito ↔ Fatura Cliente' : isFatura ? 'Débito ↔ Fatura Fornecedor' : (isPag ? 'Débito ↔ Pagamento' : 'Crédito ↔ Recebimento');
                  return (
                    <label key={i} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedAutoMatches[i] ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-400' : 'bg-muted/30 hover:bg-muted/50'}`}>
                      <input type="checkbox" checked={!!selectedAutoMatches[i]} onChange={() => setSelectedAutoMatches((prev) => ({ ...prev, [i]: !prev[i] }))} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${match.confidence === 'alta' ? 'bg-emerald-100 text-emerald-700' : match.confidence === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {match.confidence.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">{typeLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-medium truncate">{mov?.descricao || 'Movimento'}</p>
                            <p className="text-muted-foreground">{mov ? `${formatCurrency(mov.valor)} • ${formatDate(mov.dataMovimento)}` : ''}</p>
                          </div>
                          <div>
                            {(isFatura || isFaturaCliente) ? (
                              <>
                                <p className="font-medium truncate">{isFaturaCliente ? (fat?.cliente?.nome || fat?.entidadeNome || 'Cliente') : (fat?.fornecedor?.nome || fat?.entidadeNome || 'Fornecedor')}</p>
                                <p className="text-muted-foreground">Fatura {fat?.numero || 'S/N'}{fat?.dataEmissao ? ` · ${formatDate(fat.dataEmissao)}` : ''}</p>
                                <p className="text-muted-foreground">{fat ? `${formatCurrency(fat.saldoPendente ?? fat.valor)} pendente` : ''}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium truncate">{target?.descricao || (isPag ? 'Pagamento' : 'Recebimento')}</p>
                                <p className="text-muted-foreground">{target ? `${formatCurrency(target.valor)} • ${formatDate(isPag ? (target as any).dataPagamento : (target as any).dataRecebimento)}` : ''}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="border-t pt-4 mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{Object.values(selectedAutoMatches).filter(Boolean).length} de {autoMatches.length} selecionada(s)</span>
                <button onClick={handleApplyAutoMatches} disabled={autoRunning || Object.values(selectedAutoMatches).filter(Boolean).length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                  {autoRunning ? <><Loader2 className="h-4 w-4 animate-spin" />A aplicar...</> : <><CheckCircle2 className="h-4 w-4" />Aplicar Reconciliações</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}