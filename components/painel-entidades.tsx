'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Truck, FileText, FileCheck, FileMinus, ArrowDownCircle, ArrowUpCircle,
  ClipboardList, FileSearch, AlertTriangle, CheckCircle2, Plug, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { MoloniSyncButton } from '@/components/moloni-sync-button';
import { formatCurrency, formatDate } from '@/lib/format';

type Doc = { id: string; tipo: string; numero: string; entidade: string; valor: number; emFalta: number; dataEmissao: string | null; dataVencimento: string | null; vencida: boolean };
type Painel = {
  lado: 'clientes' | 'fornecedores';
  entidades: number;
  faturas: { ano: number; quantidadeAno: number; mes: number; quantidadeMes: number; bruto: number };
  pendentes: { total: number; quantidade: number; vencidas: number; valorVencido: number; itens: Doc[] };
  recibos: { total: number; quantidade: number };
  notas: { total: number; quantidade: number; credito: number; debito: number };
  orcamentos: number;
  movimentos: { pendentes: { total: number; quantidade: number }; mes: { total: number; quantidade: number } };
  efatura: { mes: string; emFalta: number; valorEmFalta: number } | null;
  porMes: { mes: string; valor: number }[];
  principais: { id: string | null; nome: string; valor: number; documentos: number; pendente: number }[];
  ultimos: Doc[];
};

const TIPO_DOC: Record<string, string> = {
  emitida: 'Fatura', recebida: 'Fatura', recibo: 'Recibo', nota: 'Nota', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito',
};

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

function Cartao({ href, icon: Icon, cor, titulo, valor, detalhe, alerta }: {
  href: string; icon: any; cor: string; titulo: string; valor: string; detalhe: string; alerta?: boolean;
}) {
  return (
    <Link href={href} className="group bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${cor}`} />{titulo}</p>
      <p className="text-2xl font-bold font-display tabular-nums mt-1">{valor}</p>
      <p className={`text-xs mt-0.5 flex items-center justify-between gap-2 ${alerta ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
        <span>{detalhe}</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition shrink-0 text-muted-foreground" />
      </p>
    </Link>
  );
}

export function PainelEntidades({ lado }: { lado: 'clientes' | 'fornecedores' }) {
  const clientes = lado === 'clientes';
  const [data, setData] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/painel-${lado}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Erro ao carregar');
      setData(d);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar');
    }
  }, [lado]);

  useEffect(() => { carregar(); }, [carregar]);

  const o = clientes ? 'cliente' : 'fornecedor';
  const links = {
    entidades: clientes ? '/clientes' : '/fornecedores',
    faturas: clientes ? '/faturas?tipo=emitida&origem=cliente' : '/faturas?tipo=recebida&origem=fornecedor',
    recibos: `/faturas?tipo=recibo&origem=${o}`,
    notas: `/faturas?tipo=nota&origem=${o}`,
    movimentos: clientes ? '/recebimentos' : '/pagamentos',
  };
  const maxMes = Math.max(1, ...(data?.porMes ?? []).map((m) => m.valor));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={clientes ? 'Dashboard de Clientes' : 'Dashboard de Fornecedores'}
        description={clientes ? 'Resumo de clientes, faturas, recibos, notas de crédito e recebimentos' : 'Resumo de fornecedores, faturas, recibos, notas de crédito, orçamentos e pagamentos'}
      />

      {/* Moloni */}
      <section className="bg-card rounded-xl p-4 border border-border shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Plug className="h-4 w-4 text-blue-600" />Ir buscar ao Moloni</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {clientes
                ? 'Importa os documentos novos e atualiza os existentes (os clientes são atualizados primeiro).'
                : 'Importa os documentos registados nas Compras do Moloni (os fornecedores são atualizados primeiro). Os que já estão na app com o mesmo NIF, número e valor não são duplicados.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {clientes ? (
              <>
                <MoloniSyncButton alvo="faturas" label="Faturas" onDone={carregar} />
                <MoloniSyncButton alvo="recibos" label="Recibos" onDone={carregar} />
                <MoloniSyncButton alvo="notas" label="Notas de Crédito" onDone={carregar} />
              </>
            ) : (
              <>
                <MoloniSyncButton alvo="fornecedor-faturas" label="Faturas" onDone={carregar} />
                <MoloniSyncButton alvo="fornecedor-recibos" label="Recibos" onDone={carregar} />
                <MoloniSyncButton alvo="fornecedor-notas" label="Notas de Crédito" onDone={carregar} />
              </>
            )}
          </div>
        </div>
      </section>

      {erro && <p className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{erro}</p>}

      {!data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Um cartão por cada página do menu */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cartao href={links.faturas} icon={clientes ? ArrowDownCircle : ArrowUpCircle} cor={clientes ? 'text-emerald-600' : 'text-red-600'}
              titulo={clientes ? 'Por receber' : 'Por pagar'} valor={formatCurrency(data.pendentes.total)}
              detalhe={data.pendentes.vencidas ? `${plural(data.pendentes.vencidas, 'vencida', 'vencidas')} · ${formatCurrency(data.pendentes.valorVencido)}` : plural(data.pendentes.quantidade, 'fatura', 'faturas')}
              alerta={data.pendentes.vencidas > 0} />
            <Cartao href={links.faturas} icon={FileText} cor="text-purple-600"
              titulo={clientes ? 'Faturas Clientes (ano)' : 'Faturas Fornecedores (ano)'} valor={formatCurrency(data.faturas.ano)}
              detalhe={`${plural(data.faturas.quantidadeAno, 'fatura', 'faturas')}${data.notas.quantidade ? ' · já sem notas de crédito' : ''} · este mês ${formatCurrency(data.faturas.mes)}`} />
            <Cartao href={links.recibos} icon={FileCheck} cor="text-teal-600"
              titulo="Recibos (ano)" valor={formatCurrency(data.recibos.total)} detalhe={plural(data.recibos.quantidade, 'recibo', 'recibos')} />
            <Cartao href={links.notas} icon={FileMinus} cor="text-amber-600"
              titulo="Notas de Crédito (ano)" valor={formatCurrency(data.notas.total)}
              detalhe={`${plural(data.notas.credito, 'de crédito', 'de crédito')}${data.notas.debito ? ` · ${data.notas.debito} de débito` : ''}`} />
            <Cartao href={links.entidades} icon={clientes ? Users : Truck} cor="text-blue-600"
              titulo={clientes ? 'Clientes' : 'Fornecedores'} valor={String(data.entidades)} detalhe="registados" />
            <Cartao href={links.movimentos} icon={clientes ? ArrowDownCircle : ArrowUpCircle} cor={clientes ? 'text-emerald-600' : 'text-red-600'}
              titulo={clientes ? 'Recebimentos' : 'Pagamentos'} valor={formatCurrency(data.movimentos.mes.total)}
              detalhe={`este mês · ${plural(data.movimentos.pendentes.quantidade, 'pendente', 'pendentes')}${data.movimentos.pendentes.quantidade ? ` (${formatCurrency(data.movimentos.pendentes.total)})` : ''}`} />
            {!clientes && (
              <Cartao href="/faturas?tipo=orcamento&origem=fornecedor" icon={ClipboardList} cor="text-slate-600"
                titulo="Orçamentos" valor={String(data.orcamentos)} detalhe="de fornecedores" />
            )}
            {!clientes && (
              <Cartao href="/efatura" icon={FileSearch} cor="text-indigo-600"
                titulo="e-Fatura (AT)" valor={data.efatura ? String(data.efatura.emFalta) : '—'}
                detalhe={data.efatura ? `em falta na app · ${data.efatura.mes}` : 'nenhum mês importado'}
                alerta={!!data.efatura?.emFalta} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por receber / por pagar */}
            <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  {clientes ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" /> : <ArrowUpCircle className="h-5 w-5 text-red-600" />}
                  {clientes ? 'Faturas por receber' : 'Faturas por pagar'}
                </h2>
                <Link href={links.faturas} className="text-xs text-primary hover:underline">Ver todas</Link>
              </div>
              {data.pendentes.itens.length === 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Nada pendente.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.pendentes.itens.map((f) => (
                    <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.entidade}</p>
                        <p className={`text-xs ${f.vencida ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                          {f.numero} · {f.dataVencimento ? `vence ${formatDate(f.dataVencimento)}` : `emitida ${formatDate(f.dataEmissao)}`}{f.vencida ? ' · vencida' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-semibold text-sm">{formatCurrency(f.emFalta)}</p>
                        {f.emFalta < f.valor - 0.01 && <p className="text-[11px] text-muted-foreground">de {formatCurrency(f.valor)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.pendentes.quantidade > data.pendentes.itens.length && (
                <p className="text-xs text-muted-foreground mt-2">e mais {data.pendentes.quantidade - data.pendentes.itens.length}…</p>
              )}
            </section>

            {/* Faturado por mês */}
            <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><FileText className="h-5 w-5 text-purple-600" />{clientes ? 'Faturado a clientes por mês' : 'Faturado por fornecedores por mês'}<span className="text-xs font-normal text-muted-foreground">(já sem notas de crédito)</span></h2>
              <div className="space-y-1.5">
                {data.porMes.map((m) => (
                  <div key={m.mes} className="flex items-center gap-3 text-xs">
                    <span className="w-8 text-muted-foreground">{m.mes}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div className={`h-full rounded ${clientes ? 'bg-emerald-500/70' : 'bg-red-500/60'}`} style={{ width: `${(m.valor / maxMes) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right font-mono tabular-nums">{formatCurrency(m.valor)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Principais clientes / fornecedores */}
            <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">{clientes ? <Users className="h-5 w-5 text-blue-600" /> : <Truck className="h-5 w-5 text-blue-600" />}{clientes ? 'Principais clientes (ano)' : 'Principais fornecedores (ano)'}</h2>
                <Link href={links.entidades} className="text-xs text-primary hover:underline">Ver todos</Link>
              </div>
              {data.principais.length === 0 ? <p className="text-sm text-muted-foreground">Sem faturas este ano.</p> : (
                <ul className="divide-y divide-border">
                  {data.principais.map((e) => (
                    <li key={e.id ?? e.nome} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.nome}</p>
                        <p className="text-xs text-muted-foreground">{plural(e.documentos, 'fatura', 'faturas')}{e.pendente > 0 ? ` · ${formatCurrency(e.pendente)} ${clientes ? 'por receber' : 'por pagar'}` : ''}</p>
                      </div>
                      <p className="font-mono font-semibold text-sm shrink-0">{formatCurrency(e.valor)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Últimos documentos */}
            <section className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><FileCheck className="h-5 w-5 text-teal-600" />Últimos documentos</h2>
              {data.ultimos.length === 0 ? <p className="text-sm text-muted-foreground">Sem documentos.</p> : (
                <ul className="divide-y divide-border">
                  {data.ultimos.map((f) => (
                    <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.entidade}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_DOC[f.tipo] || f.tipo} {f.numero} · {formatDate(f.dataEmissao)}</p>
                      </div>
                      <p className="font-mono font-semibold text-sm shrink-0">{formatCurrency(f.valor)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
