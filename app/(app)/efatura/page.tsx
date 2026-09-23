'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileSearch,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Eye,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

type Correspondencia = {
  forma: 'numero' | 'valor';
  origem: 'fatura' | 'despesa';
  id: string;
  numero: string | null;
  valor: number | null;
  data: string | null;
};

type Documento = {
  id: string;
  emitenteNif: string;
  emitenteNome: string;
  numero: string;
  atcud: string | null;
  tipo: string;
  dataEmissao: string;
  total: number;
  iva: number | null;
  ignorado: boolean;
  nota: string | null;
  estado: 'na_app' | 'em_falta' | 'ignorado';
  correspondencia: Correspondencia | null;
};

type Resposta = {
  meses: { mes: string; total: number }[];
  mes: string | null;
  documentos: Documento[];
  resumo: { total: number; naApp: number; emFalta: number; ignorados: number; valorEmFalta: number } | null;
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const nomeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
};

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'em_falta', label: 'Em falta' },
  { key: 'na_app', label: 'Na app' },
  { key: 'ignorado', label: 'Ignorados' },
] as const;

export default function EFaturaPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['key']>('todos');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (m: string | null) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/efatura${m ? `?mes=${m}` : ''}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao carregar');
      setDados(d);
      setMes(d.mes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(null);
  }, [carregar]);

  const importar = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/efatura/importar', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao importar');
      toast.success(`${d.total} documentos importados (${d.novos} novos, ${d.atualizados} atualizados)`);
      await carregar(d.meses[d.meses.length - 1] ?? null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const alternarIgnorado = async (doc: Documento) => {
    const r = await fetch(`/api/efatura/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignorado: !doc.ignorado }),
    });
    if (!r.ok) return toast.error('Não foi possível atualizar');
    carregar(mes);
  };

  const apagarMes = async () => {
    if (!mes || !confirm(`Apagar todos os documentos do e-Fatura de ${nomeMes(mes)}? Pode voltar a importar o Excel depois.`)) return;
    const r = await fetch(`/api/efatura?mes=${mes}`, { method: 'DELETE' });
    if (!r.ok) return toast.error('Não foi possível apagar');
    toast.success('Mês apagado');
    carregar(null);
  };

  const docs = (dados?.documentos ?? []).filter((d) => filtro === 'todos' || d.estado === filtro);
  const resumo = dados?.resumo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="e-Fatura (AT)"
        description="Importe todos os meses o Excel do e-Fatura. Cada documento comunicado pelos fornecedores é verificado nas faturas, notas e despesas da app."
        icon={FileSearch}
        action={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'A importar...' : 'Importar Excel do e-Fatura'}
            </button>
          </div>
        }
      />

      {dados && dados.meses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {dados.meses.map((m) => (
            <button
              key={m.mes}
              onClick={() => carregar(m.mes)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                m.mes === mes ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
              }`}
            >
              {nomeMes(m.mes)} <span className="opacity-70">({m.total})</span>
            </button>
          ))}
          {mes && (
            <button
              onClick={apagarMes}
              title="Apagar os documentos deste mês"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Apagar mês
            </button>
          )}
        </div>
      )}

      {resumo && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Documentos no e-Fatura</p>
            <p className="mt-1 text-2xl font-semibold">{resumo.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Na app</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{resumo.naApp}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
            <p className="text-xs text-red-700 dark:text-red-400">Em falta na app</p>
            <p className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-400">{resumo.emFalta}</p>
            <p className="text-xs text-red-700/80 dark:text-red-400/80">{formatCurrency(resumo.valorEmFalta)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Ignorados</p>
            <p className="mt-1 text-2xl font-semibold">{resumo.ignorados}</p>
          </div>
        </div>
      )}

      {resumo && resumo.emFalta > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>
            Há <strong>{resumo.emFalta}</strong> documento{resumo.emFalta === 1 ? '' : 's'} comunicado{resumo.emFalta === 1 ? '' : 's'} à AT
            em {mes ? nomeMes(mes) : ''} que não {resumo.emFalta === 1 ? 'está' : 'estão'} na app. Lance-os em Faturas de Fornecedores ou
            Despesas, ou marque-os como ignorados se não forem para lançar.
          </p>
        </div>
      )}

      {dados && dados.meses.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filtro === f.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !dados || dados.meses.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Ainda não há meses importados"
          description="No Portal das Finanças, em e-Fatura → Faturas de aquisição, exporte o mês para Excel e importe-o aqui."
        />
      ) : docs.length === 0 ? (
        <EmptyState icon={FileSearch} title="Sem documentos neste filtro" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Data</th>
                <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 font-medium">Documento</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">Na app</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className={`border-t border-border ${d.estado === 'em_falta' ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {d.estado === 'na_app' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Na app
                      </span>
                    )}
                    {d.estado === 'em_falta' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> Em falta
                      </span>
                    )}
                    {d.estado === 'ignorado' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <EyeOff className="h-3.5 w-3.5" /> Ignorado
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(d.dataEmissao)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{d.emitenteNome}</div>
                    <div className="text-xs text-muted-foreground">NIF {d.emitenteNif}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-xs">{d.numero}</div>
                    <div className="text-xs text-muted-foreground">{d.tipo}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">{formatCurrency(d.total)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {d.correspondencia ? (
                      <div>
                        <span className="font-medium">{d.correspondencia.origem === 'fatura' ? 'Fatura' : 'Despesa'}</span>
                        {d.correspondencia.numero && <span className="text-muted-foreground"> · {d.correspondencia.numero.slice(0, 40)}</span>}
                        {d.correspondencia.forma === 'valor' && (
                          <div className="text-muted-foreground">encontrada pelo valor e data</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {d.estado !== 'na_app' && (
                      <button
                        onClick={() => alternarIgnorado(d)}
                        title={d.ignorado ? 'Voltar a verificar este documento' : 'Não é para lançar na app'}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {d.ignorado ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {d.ignorado ? 'Repor' : 'Ignorar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
