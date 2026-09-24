'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ScanLine,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Copy,
  FolderOpen,
  FileSignature,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { formatDateTime, formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

type Item = {
  id: string;
  pasta: string;
  modulo: string;
  nomeOriginal: string;
  contentType?: string | null;
  estado: string;
  erroMsg?: string | null;
  dadosExtraidos?: any;
  criadoPor?: string | null;
  createdAt: string;
  onedriveModified?: string | null;
};

const PASTA_LABEL: Record<string, string> = {
  DESPESAS: 'Despesas',
  FORNECEDORES: 'Fornecedores',
  IMPOSTOS: 'Impostos',
  SEGUROS: 'Seguros',
  VENCIMENTOS: 'Vencimentos',
};

// Campos editáveis por módulo (key, label, tipo).
type Campo = { key: string; label: string; tipo: 'text' | 'number' | 'date' };
const CAMPOS: Record<string, Campo[]> = {
  despesa: [
    { key: 'descricao', label: 'Descrição', tipo: 'text' },
    { key: 'categoria', label: 'Categoria', tipo: 'text' },
    { key: 'valor', label: 'Valor (€)', tipo: 'number' },
    { key: 'data', label: 'Data', tipo: 'date' },
    { key: 'entidadeNome', label: 'Entidade', tipo: 'text' },
    { key: 'entidadeNif', label: 'NIF', tipo: 'text' },
  ],
  fatura_fornecedor: [
    { key: 'descricao', label: 'Descrição', tipo: 'text' },
    { key: 'fornecedorNome', label: 'Fornecedor', tipo: 'text' },
    { key: 'fornecedorNif', label: 'NIF', tipo: 'text' },
    { key: 'valor', label: 'Valor (€)', tipo: 'number' },
    { key: 'dataFatura', label: 'Data da fatura', tipo: 'date' },
    { key: 'numeroFatura', label: 'N.º fatura', tipo: 'text' },
  ],
  pagamento: [
    { key: 'descricao', label: 'Descrição', tipo: 'text' },
    { key: 'fornecedorNome', label: 'Fornecedor', tipo: 'text' },
    { key: 'fornecedorNif', label: 'NIF', tipo: 'text' },
    { key: 'valor', label: 'Valor (€)', tipo: 'number' },
    { key: 'dataPagamento', label: 'Data do pagamento', tipo: 'date' },
    { key: 'referencia', label: 'Referência', tipo: 'text' },
  ],
  imposto: [
    { key: 'tipo', label: 'Tipo', tipo: 'text' },
    { key: 'descricao', label: 'Descrição', tipo: 'text' },
    { key: 'valor', label: 'Valor (€)', tipo: 'number' },
    { key: 'periodo', label: 'Período', tipo: 'text' },
    { key: 'dataVencimento', label: 'Vencimento', tipo: 'date' },
    { key: 'entidadeNome', label: 'Entidade', tipo: 'text' },
    { key: 'entidadeNif', label: 'NIF', tipo: 'text' },
    { key: 'referencia', label: 'Referência', tipo: 'text' },
  ],
  seguro: [
    { key: 'tipo', label: 'Tipo', tipo: 'text' },
    { key: 'seguradora', label: 'Seguradora', tipo: 'text' },
    { key: 'apolice', label: 'Apólice', tipo: 'text' },
    { key: 'valor', label: 'Valor (€)', tipo: 'number' },
    { key: 'periodicidade', label: 'Periodicidade', tipo: 'text' },
    { key: 'dataInicio', label: 'Início', tipo: 'date' },
    { key: 'dataVencimento', label: 'Vencimento', tipo: 'date' },
    { key: 'referencia', label: 'Referência', tipo: 'text' },
  ],
  vencimento: [
    { key: 'funcionario', label: 'Funcionário', tipo: 'text' },
    { key: 'cargo', label: 'Cargo', tipo: 'text' },
    { key: 'valorBruto', label: 'Bruto (€)', tipo: 'number' },
    { key: 'valorLiquido', label: 'Líquido (€)', tipo: 'number' },
    { key: 'segSocial', label: 'Seg. Social (€)', tipo: 'number' },
    { key: 'irs', label: 'IRS (€)', tipo: 'number' },
    { key: 'outrosDescontos', label: 'Outros desc. (€)', tipo: 'number' },
    { key: 'periodo', label: 'Período (AAAA-MM)', tipo: 'text' },
    { key: 'dataPagamento', label: 'Data pagamento', tipo: 'date' },
  ],
};

const TABS: { key: string; label: string }[] = [
  { key: 'por_confirmar', label: 'Por confirmar' },
  { key: 'duplicado', label: 'Duplicados' },
  { key: 'erro', label: 'Erros' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'ignorado', label: 'Ignorados' },
];

// Pré-visualização do documento. Nos registos já tratados só carrega a pedido:
// abrir a página com dezenas de documentos de uma vez esgota os limites do
// alojamento ("Resource Limit Is Reached").
function PreVisualizacao({ id, nome, automatica }: { id: string; nome: string; automatica: boolean }) {
  const [mostrar, setMostrar] = useState(automatica);
  if (!mostrar) {
    return (
      <button
        type="button"
        onClick={() => setMostrar(true)}
        className="flex h-[120px] w-full items-center justify-center gap-2 bg-muted/20 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <Eye className="h-4 w-4" /> Ver documento
      </button>
    );
  }
  return (
    <iframe
      src={`/api/digitalizacoes/${id}/ficheiro`}
      loading="lazy"
      className="w-full h-[300px] bg-white"
      title={nome}
    />
  );
}

export default function DigitalizacoesPage() {
  const [tab, setTab] = useState('por_confirmar');
  const [itens, setItens] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Faturas por liquidar (para conciliar comprovativos de pagamento).
  const [faturasByItem, setFaturasByItem] = useState<Record<string, any[]>>({});
  const [loadingFaturas, setLoadingFaturas] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async (estado: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/digitalizacoes?estado=${estado}`);
      const data = await res.json();
      setItens(data.itens || []);
      setResumo(data.resumo || {});
    } catch {
      toast.error('Não foi possível carregar as digitalizações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(tab);
  }, [tab, carregar]);

  const verificarAgora = async () => {
    setSyncing(true);
    toast.info('A verificar o OneDrive... pode demorar alguns instantes.');
    const totais = { novos: 0, duplicados: 0, erros: 0 };
    try {
      // Os documentos são processados em lotes pequenos. Repetimos a chamada
      // enquanto ainda houver ficheiros novos por processar.
      let continuar = true;
      let voltas = 0;
      while (continuar && voltas < 100) {
        voltas++;
        const res = await fetch('/api/digitalizacoes/sync', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Falha na verificação.');
          break;
        }
        totais.novos += data.novos || 0;
        totais.duplicados += data.duplicados || 0;
        totais.erros += data.erros || 0;
        continuar = !!data.maisPorProcessar;
        if (continuar) {
          toast.info(`A processar documentos... ${totais.novos} novo(s) até agora.`);
          await carregar(tab);
        }
      }
      toast.success(
        `Verificação concluída: ${totais.novos} novo(s), ${totais.duplicados} duplicado(s), ${totais.erros} erro(s).`
      );
      await carregar(tab);
    } catch {
      toast.error('Falha na verificação.');
    } finally {
      setSyncing(false);
    }
  };

  const renomearExistentes = async () => {
    if (
      !window.confirm(
        'Vai renomear no OneDrive os ficheiros das digitalizações já confirmadas para o novo formato (Fatura_/Comprovativo_/Despesa_). Esta ação altera os ficheiros reais e não é reversível. Continuar?'
      )
    ) {
      return;
    }
    setRenaming(true);
    toast.info('A renomear ficheiros no OneDrive... pode demorar alguns instantes.');
    const totais = { renomeados: 0, erros: 0 };
    try {
      let continuar = true;
      let voltas = 0;
      while (continuar && voltas < 100) {
        voltas++;
        const res = await fetch('/api/digitalizacoes/rename-existentes', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Falha na renomeação.');
          break;
        }
        totais.renomeados += data.renomeados || 0;
        totais.erros += data.erros || 0;
        continuar = !!data.maisPorProcessar;
        if (continuar) {
          toast.info(`A renomear... ${totais.renomeados} ficheiro(s) até agora.`);
        }
      }
      toast.success(
        `Renomeação concluída: ${totais.renomeados} renomeado(s)` +
          (totais.erros ? `, ${totais.erros} erro(s).` : '.')
      );
      await carregar(tab);
    } catch {
      toast.error('Falha na renomeação.');
    } finally {
      setRenaming(false);
    }
  };

  const getVal = (item: Item, key: string) => {
    const e = edits[item.id];
    if (e && key in e) return e[key];
    return item.dadosExtraidos?.[key] ?? '';
  };

  const setVal = (item: Item, key: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), [key]: value },
    }));
  };

  const dadosFinais = (item: Item) => {
    const base = { ...(item.dadosExtraidos || {}) };
    const e = edits[item.id] || {};
    for (const k of Object.keys(e)) {
      let v: any = e[k];
      const campo = (CAMPOS[item.modulo] || []).find((c) => c.key === k);
      if (campo?.tipo === 'number') {
        v = v === '' ? null : parseFloat(String(v).replace(',', '.'));
        if (Number.isNaN(v)) v = null;
      }
      base[k] = v === '' ? null : v;
    }
    return base;
  };

  // ------- Conciliação de comprovativos de pagamento com faturas -------
  const buscarFaturas = useCallback(async (itemId: string, nifRaw: any, nomeRaw: any) => {
    const nif = String(nifRaw ?? '').replace(/\D/g, '');
    const nome = String(nomeRaw ?? '').trim();
    if (!nif && !nome) {
      setFaturasByItem((p) => ({ ...p, [itemId]: [] }));
      return;
    }
    setLoadingFaturas((p) => ({ ...p, [itemId]: true }));
    try {
      const qs = new URLSearchParams({ tipo: 'recebida' });
      if (nif) qs.set('nif', nif);
      if (nome) qs.set('nome', nome);
      const res = await fetch(`/api/faturas/pendentes?${qs.toString()}`);
      const data = await res.json();
      setFaturasByItem((p) => ({ ...p, [itemId]: Array.isArray(data) ? data : [] }));
    } catch {
      setFaturasByItem((p) => ({ ...p, [itemId]: [] }));
    } finally {
      setLoadingFaturas((p) => ({ ...p, [itemId]: false }));
    }
  }, []);

  // Carrega automaticamente as faturas por liquidar dos comprovativos de
  // pagamento assim que a lista é apresentada.
  useEffect(() => {
    itens.forEach((item) => {
      if (
        item.modulo === 'pagamento' &&
        (item.estado === 'por_confirmar' || item.estado === 'duplicado') &&
        faturasByItem[item.id] === undefined
      ) {
        buscarFaturas(
          item.id,
          item.dadosExtraidos?.fornecedorNif,
          item.dadosExtraidos?.fornecedorNome
        );
      }
    });
  }, [itens, faturasByItem, buscarFaturas]);

  const faturasSelecionadas = (item: Item): string[] => {
    const v = getVal(item, 'faturaIds');
    return Array.isArray(v) ? v : [];
  };

  const toggleFatura = (item: Item, fatura: any) => {
    const atuais = faturasSelecionadas(item);
    const existe = atuais.includes(fatura.id);
    const novas = existe ? atuais.filter((x) => x !== fatura.id) : [...atuais, fatura.id];
    setVal(item, 'faturaIds', novas as any);
    // Auto-preenche valor/descrição com a 1.ª fatura selecionada, se vazios.
    if (!existe && novas.length === 1) {
      const valorAtual = getVal(item, 'valor');
      if (valorAtual === '' || valorAtual == null) {
        const val = fatura.saldoPendente ?? fatura.valor;
        if (val != null) setVal(item, 'valor', String(val));
      }
      const descAtual = getVal(item, 'descricao');
      if ((!descAtual || String(descAtual).trim() === '') && fatura.numero) {
        setVal(item, 'descricao', `Pag. ${fatura.numero}`);
      }
    }
  };

  const confirmar = async (item: Item) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/digitalizacoes/${item.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dadosExtraidos: dadosFinais(item) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível criar o registo.');
      } else {
        toast.success('Registo criado com sucesso.');
        setItens((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      toast.error('Erro ao confirmar.');
    } finally {
      setBusyId(null);
    }
  };

  const mudarEstado = async (item: Item, estado: string) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/digitalizacoes/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error();
      toast.success(estado === 'ignorado' ? 'Marcado como ignorado.' : 'Movido para revisão.');
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      toast.error('Não foi possível atualizar.');
    } finally {
      setBusyId(null);
    }
  };

  const eliminar = async (item: Item) => {
    if (!confirm('Remover este registo de importação? O documento voltará a ser detetado na próxima verificação.')) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/digitalizacoes/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Registo removido.');
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      toast.error('Não foi possível remover.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitalizações OneDrive"
        description="Documentos colocados nas pastas do OneDrive são lidos automaticamente e ficam aqui para validação antes de criar os registos."
        icon={ScanLine}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={renomearExistentes}
              disabled={renaming || syncing}
              title="Renomear no OneDrive os ficheiros já confirmados para o novo formato"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-60"
            >
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              {renaming ? 'A renomear...' : 'Renomear existentes'}
            </button>
            <button
              onClick={verificarAgora}
              disabled={syncing || renaming}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'A verificar...' : 'Verificar agora'}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {resumo[t.key] ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                  {resumo[t.key]}
                </span>
              ) : null}
            </span>
            {tab === t.key && (
              <motion.div layoutId="tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sem documentos nesta lista"
          description={
            tab === 'por_confirmar'
              ? 'Coloque ficheiros nas pastas do OneDrive e clique em “Verificar agora”. Os documentos aparecerão aqui para validação.'
              : 'Não existem documentos neste estado.'
          }
        />
      ) : (
        <div className="space-y-4">
          {itens.map((item) => {
            const campos = CAMPOS[item.modulo] || [];
            const editavel = item.estado === 'por_confirmar' || item.estado === 'duplicado';
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Pré-visualização */}
                  <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-border bg-muted/30">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                          {PASTA_LABEL[item.pasta] || item.pasta}
                        </span>
                        <span className="truncate max-w-[160px]" title={item.nomeOriginal}>
                          {item.nomeOriginal}
                        </span>
                      </span>
                      <Link
                        href={`/api/digitalizacoes/${item.id}/ficheiro`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <PreVisualizacao
                      id={item.id}
                      nome={item.nomeOriginal}
                      automatica={editavel || item.estado === 'erro'}
                    />
                  </div>

                  {/* Dados */}
                  <div className="flex-1 p-4 space-y-4">
                    {item.estado === 'duplicado' && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                        <Copy className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>Possível duplicado de um registo já existente. Reveja antes de confirmar.</span>
                      </div>
                    )}
                    {item.estado === 'erro' && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{item.erroMsg || 'Não foi possível extrair os dados deste documento.'}</span>
                      </div>
                    )}

                    {campos.length > 0 && item.estado !== 'erro' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {campos.map((c) => (
                          <div key={c.key} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{c.label}</label>
                            <input
                              type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
                              step={c.tipo === 'number' ? '0.01' : undefined}
                              value={getVal(item, c.key) ?? ''}
                              onChange={(e) => setVal(item, c.key, e.target.value)}
                              disabled={!editavel}
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {item.modulo === 'pagamento' && editavel && item.estado !== 'erro' && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground">Fatura(s) a conciliar</label>
                          <button
                            type="button"
                            onClick={() => buscarFaturas(item.id, getVal(item, 'fornecedorNif'), getVal(item, 'fornecedorNome'))}
                            disabled={loadingFaturas[item.id]}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
                          >
                            <RefreshCw className={`h-3 w-3 ${loadingFaturas[item.id] ? 'animate-spin' : ''}`} /> Atualizar
                          </button>
                        </div>
                        {(() => {
                          const nif = String(getVal(item, 'fornecedorNif') || '').trim();
                          const nome = String(getVal(item, 'fornecedorNome') || '').trim();
                          if (!nif && !nome) {
                            return (
                              <p className="text-xs text-muted-foreground">
                                Preencha o fornecedor para ver as faturas por liquidar.
                              </p>
                            );
                          }
                          if (loadingFaturas[item.id]) {
                            return (
                              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> A procurar faturas...
                              </p>
                            );
                          }
                          const lista = faturasByItem[item.id] || [];
                          if (lista.length === 0) {
                            return (
                              <p className="text-xs text-muted-foreground">
                                Sem faturas por liquidar para <b>{nome || nif}</b>.
                              </p>
                            );
                          }
                          const selec = faturasSelecionadas(item);
                          return (
                            <>
                              <p className="text-[11px] text-muted-foreground">
                                Selecione a(s) fatura(s) desta empresa que este comprovativo liquida.
                              </p>
                              <div className="max-h-52 space-y-1.5 overflow-auto pr-1">
                                {lista.map((f: any) => {
                                  const on = selec.includes(f.id);
                                  return (
                                    <label
                                      key={f.id}
                                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        on ? 'border-emerald-300 bg-emerald-50' : 'border-input bg-background hover:bg-muted/50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => toggleFatura(item, f)}
                                        className="h-4 w-4 rounded border-input accent-emerald-600"
                                      />
                                      <span className="flex-1">
                                        <span className="font-medium text-foreground">{f.numero || 'Fatura s/ n.º'}</span>
                                        {f.dataEmissao && (
                                          <span className="text-muted-foreground"> · {formatDate(f.dataEmissao)}</span>
                                        )}
                                      </span>
                                      <span className="whitespace-nowrap font-semibold text-emerald-700">
                                        {formatCurrency(f.saldoPendente ?? f.valor ?? 0)}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              {selec.length > 0 && (
                                <p className="text-[11px] font-medium text-emerald-700">
                                  {selec.length} fatura(s) selecionada(s) — serão marcadas como pagas ao confirmar.
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-muted-foreground">
                        Importado {formatDateTime(item.createdAt)}
                        {item.criadoPor ? ` · ${item.criadoPor}` : ''}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(item.estado === 'por_confirmar' || item.estado === 'duplicado') && (
                          <>
                            <button
                              onClick={() => mudarEstado(item, 'ignorado')}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
                            >
                              <XCircle className="h-4 w-4" /> Ignorar
                            </button>
                            <button
                              onClick={() => confirmar(item)}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Confirmar e criar
                            </button>
                          </>
                        )}
                        {item.estado === 'erro' && (
                          <button
                            onClick={() => eliminar(item)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" /> Remover e reprocessar
                          </button>
                        )}
                        {item.estado === 'ignorado' && (
                          <button
                            onClick={() => mudarEstado(item, 'por_confirmar')}
                            disabled={busyId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                          >
                            Repor para revisão
                          </button>
                        )}
                        {item.estado === 'confirmado' && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Registo criado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}