'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Printer, Plus, Search, Loader2, Trash2, Eye, Copy, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { formatCurrency, formatDate } from '@/lib/format';
import { formatNumeroOrcamento, anoDe, TIPOS_ORCAMENTO } from '@/lib/grafica/numero';
import { toast } from 'sonner';

const ESTADOS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-slate-200 text-slate-700' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800' },
  em_analise: { label: 'Em Análise', cls: 'bg-blue-100 text-blue-800' },
  adjudicado: { label: 'Adjudicado', cls: 'bg-emerald-100 text-emerald-800' },
  producao: { label: 'Em Produção', cls: 'bg-sky-100 text-sky-800' },
  finalizado: { label: 'Finalizado', cls: 'bg-indigo-100 text-indigo-800' },
  recusado: { label: 'Recusado', cls: 'bg-red-100 text-red-800' },
};

const PRODUTOS: Record<string, string> = { cartoes: 'Cartões Comerciais', stickers: 'Stickers / Adesivos', contratar: 'Contratar (Subcontratação)', imp_peq_formato: 'Flyers', vinil: 'Impressão digital de grande formato' };

export default function OrcamentosGraficosPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (estadoFiltro) params.set('estado', estadoFiltro);
      if (tipoFiltro) params.set('tipo', tipoFiltro);
      const r = await fetch(`/api/grafica/orcamentos?${params.toString()}`);
      setItems(await r.json());
    } catch {
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, estadoFiltro, tipoFiltro]);

  const [duplicando, setDuplicando] = useState<string | null>(null);

  const duplicar = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (duplicando) return;
    setDuplicando(id);
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}/duplicar`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      toast.success('Orçamento duplicado');
      router.push(`/orcamentos-graficos/${d.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar');
      setDuplicando(null);
    }
  };

  const eliminar = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Eliminar este orçamento?')) return;
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast.success('Orçamento eliminado');
      load();
    } catch {
      toast.error('Erro ao eliminar');
    }
  };

  return (
    <div>
      <PageHeader
        title="Orçamentos Gráficos"
        description="Orçamentos de trabalhos gráficos com cálculo automático de custos e preços"
        icon={Printer}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/orcamentos-graficos/dashboard"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link
              href="/orcamentos-graficos/novo"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Novo Orçamento
            </Link>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por número, cliente, folha de obra ou notas..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_ORCAMENTO.map((t) => (
            <option key={t.id} value={t.id}>{t.id}</option>
          ))}
        </select>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="">Todos os estados</option>
          <option value="rascunho">Rascunho</option>
          <option value="pendente">Pendente</option>
          <option value="em_analise">Em Análise</option>
          <option value="adjudicado">Adjudicado</option>
          <option value="producao">Em Produção</option>
          <option value="finalizado">Finalizado</option>
          <option value="recusado">Recusado</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Printer} title="Sem orçamentos" description="Crie o primeiro orçamento gráfico." />
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">N.º</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo de Trabalho</th>
                  <th className="text-left px-4 py-3 font-medium">Folha de Obra</th>
                  <th className="text-right px-4 py-3 font-medium">Qtd</th>
                  <th className="text-right px-4 py-3 font-medium">Preço s/IVA</th>
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const est = ESTADOS[it.estado] || ESTADOS.pendente;
                  return (
                    <motion.tr
                      key={it.id}
                      initial={false}
                      onClick={() => router.push(`/orcamentos-graficos/${it.id}`)}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">{formatNumeroOrcamento(it.tipoOrcamento, it.numeroTipo, anoDe(it.createdAt))}</td>
                      <td className="px-4 py-3">{it.clienteEmpresa || it.clienteNome || <span className="text-muted-foreground">—</span>}{it.clienteEmpresa && it.clienteNome && <span className="block text-[11px] text-muted-foreground/70">{it.clienteNome}</span>}{it.criadoPor && <span className="block text-[11px] text-muted-foreground/70">Registado por {it.criadoPor}</span>}</td>
                      <td className="px-4 py-3">{PRODUTOS[it.produto] || it.produto}</td>
                      <td className="px-4 py-3">{it.folhaObra ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">{it.folhaObra}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-right">{it.quantidade}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(it.precoSemIva)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${est.cls}`}>{est.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(it.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/orcamentos-graficos/${it.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={(e) => duplicar(it.id, e)}
                            disabled={duplicando === it.id}
                            title="Duplicar"
                            className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-600 disabled:opacity-50"
                          >
                            {duplicando === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button onClick={(e) => eliminar(it.id, e)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
