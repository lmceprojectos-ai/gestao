'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Save, AlertTriangle, Calculator, Plus, Trash2, FileEdit } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { TIPOS_ORCAMENTO, tipoTemIva } from '@/lib/grafica/numero';
import { arteFinalValorSugerido } from '@/lib/grafica/arte-final';
import { toast } from 'sonner';
import { ProdutoItem, novoItemProduto, buildItemInput, buildItemPayload, itemFromStored, produtoLabel } from './produto-item';
import { normalizarDeslocacao } from '@/lib/grafica/deslocacao';

const MAX_ITENS = 20;

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

export function OrcamentoForm({ orcamentoId, duplicarId }: { orcamentoId?: string; duplicarId?: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcs, setCalcs] = useState<(any | null)[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);

  // Campos partilhados (documento).
  const [form, setForm] = useState<any>({
    clienteId: '',
    clienteNome: '',
    clienteEmpresa: '',
    clienteContacto: '',
    clienteNif: '',
    clienteEmail: '',
    clienteTelefone: '',
    clienteMorada: '',
    clienteCodigoPostal: '',
    clienteCidade: '',
    tipoOrcamento: 'OC',
    tipoCliente: 'novo',
    entrega24h: false,
    prazoManual: false,
    prazoProducao: '',
    descontoManual: '',
    tipoPortes: 'levantamento',
    portesEnvio: '',
    opcoesExtra: [] as { descricao: string; valor: string; incluida: boolean }[],
    deslocacao: { incluir: false, distanciaKm: '', custoKm: '', numTecnicos: '', horas: '', custoHora: '' },
    notas: '',
    estado: 'pendente',
  });

  // Linhas de produto.
  const [itens, setItens] = useState<any[]>([novoItemProduto()]);

  // carregar config, clientes e (se edição) orçamento existente
  useEffect(() => {
    (async () => {
      try {
        const [rc, rcl] = await Promise.all([fetch('/api/grafica/config'), fetch('/api/clientes')]);
        const cfg = await rc.json();
        const cls = await rcl.json();
        setConfig(cfg);
        setClientes(Array.isArray(cls) ? cls : []);
        setItens([novoItemProduto(cfg)]);

        const fonteId = orcamentoId || duplicarId;
        if (fonteId) {
          const ro = await fetch(`/api/grafica/orcamentos/${fonteId}`);
          if (ro.ok) {
            const o = await ro.json();
            setForm({
              clienteId: o.clienteId || '',
              clienteNome: o.clienteNome || '',
              clienteEmpresa: o.clienteEmpresa || '',
              clienteContacto: o.clienteContacto || '',
              clienteNif: o.clienteNif || '',
              clienteEmail: o.clienteEmail || '',
              clienteTelefone: o.clienteTelefone || '',
              clienteMorada: o.clienteMorada || '',
              clienteCodigoPostal: o.clienteCodigoPostal || '',
              clienteCidade: o.clienteCidade || '',
              tipoOrcamento: o.tipoOrcamento || 'OC',
              tipoCliente: o.tipoCliente || 'novo',
              entrega24h: !!o.entrega24h,
              prazoManual: !o.entrega24h && !!(o.prazoProducao && String(o.prazoProducao).trim()),
              prazoProducao: o.prazoProducao || '',
              descontoManual: o.descontoManual != null ? String(Math.round(Number(o.descontoManual) * 10000) / 100) : '',
              tipoPortes: o.tipoPortes || 'levantamento',
              portesEnvio: o.portesEnvio != null ? String(o.portesEnvio) : '',
              opcoesExtra: Array.isArray(o.opcoesExtra)
                ? o.opcoesExtra.map((x: any) => ({ descricao: x?.descricao || '', valor: x?.valor != null ? String(x.valor) : '', incluida: !!x?.incluida }))
                : [],
              deslocacao: o.deslocacao && o.deslocacao.incluir
                ? { incluir: true, distanciaKm: String(o.deslocacao.distanciaKm ?? ''), custoKm: String(o.deslocacao.custoKm ?? ''), numTecnicos: String(o.deslocacao.numTecnicos ?? ''), horas: String(o.deslocacao.horas ?? ''), custoHora: String(o.deslocacao.custoHora ?? '') }
                : { incluir: false, distanciaKm: '', custoKm: '', numTecnicos: '', horas: '', custoHora: '' },
              notas: o.notas || '',
              estado: duplicarId ? 'rascunho' : (o.estado || 'pendente'),
            });
            // Itens: usa o array `itens` guardado; senão reconstrói a partir do topo legado.
            if (Array.isArray(o.itens) && o.itens.length) {
              setItens(o.itens.map((it: any) => itemFromStored(it, cfg)));
            } else {
              setItens([itemFromStored(o, cfg)]);
            }
            if (duplicarId) toast.success('Orçamento duplicado — ajuste as opções e guarde');
          }
        }
      } catch {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId, duplicarId]);

  const sharedPayload = useCallback(() => {
    const desc = form.descontoManual !== '' && !isNaN(Number(form.descontoManual)) ? Number(form.descontoManual) / 100 : null;
    const cli = clientes.find((c) => c.id === form.clienteId);
    const nomeFinal = (form.clienteNome && form.clienteNome.trim()) || cli?.contactoNome || null;
    const empresaFinal = (form.clienteEmpresa && form.clienteEmpresa.trim()) || cli?.nome || null;
    const nifFinal = (form.clienteNif && form.clienteNif.trim()) || cli?.nif || null;
    const emailFinal = (form.clienteEmail && form.clienteEmail.trim()) || cli?.email || null;
    const telefoneFinal = (form.clienteTelefone && form.clienteTelefone.trim()) || cli?.telefone || null;
    const moradaFinal = (form.clienteMorada && form.clienteMorada.trim()) || cli?.morada || null;
    const codigoPostalFinal = (form.clienteCodigoPostal && form.clienteCodigoPostal.trim()) || cli?.codigoPostal || null;
    const cidadeFinal = (form.clienteCidade && form.clienteCidade.trim()) || cli?.cidade || null;
    // Contacto (campo legado) = telefone · email, para retrocompatibilidade com envio/e-mail e PDFs antigos.
    const contactoFinal = [telefoneFinal, emailFinal].filter(Boolean).join(' · ') || (form.clienteContacto && form.clienteContacto.trim()) || null;
    return {
      tipoOrcamento: form.tipoOrcamento,
      tipoCliente: form.tipoCliente,
      entrega24h: form.entrega24h,
      prazoProducao: form.prazoManual && form.prazoProducao && form.prazoProducao.trim() ? form.prazoProducao.trim() : null,
      descontoManual: desc,
      tipoPortes: form.tipoPortes,
      portesEnvio: form.tipoPortes === 'levantamento' ? null : (form.portesEnvio !== '' && !isNaN(Number(form.portesEnvio)) ? Number(form.portesEnvio) : null),
      opcoesExtra: (form.opcoesExtra || [])
        .filter((o: any) => (o.descricao && o.descricao.trim()) || (o.valor !== '' && !isNaN(Number(o.valor))))
        .map((o: any) => ({ descricao: (o.descricao || '').trim(), valor: o.valor !== '' && !isNaN(Number(o.valor)) ? Number(o.valor) : 0, incluida: !!o.incluida })),
      deslocacao: form.deslocacao?.incluir
        ? { incluir: true, distanciaKm: Number(form.deslocacao.distanciaKm) || 0, custoKm: Number(form.deslocacao.custoKm) || 0, numTecnicos: Number(form.deslocacao.numTecnicos) || 0, horas: Number(form.deslocacao.horas) || 0, custoHora: Number(form.deslocacao.custoHora) || 0 }
        : null,
      clienteId: form.clienteId || null,
      clienteNome: nomeFinal,
      clienteEmpresa: empresaFinal,
      clienteContacto: contactoFinal,
      clienteNif: nifFinal,
      clienteEmail: emailFinal,
      clienteTelefone: telefoneFinal,
      clienteMorada: moradaFinal,
      clienteCodigoPostal: codigoPostalFinal,
      clienteCidade: cidadeFinal,
      notas: form.notas || null,
      estado: form.estado,
    };
  }, [form, clientes]);

  const buildPayload = useCallback(() => {
    const shared = sharedPayload();
    const itensPayload = itens.map((it) => buildItemPayload(it));
    // Compatibilidade: envia também os campos do primeiro produto no topo do payload.
    const first = itensPayload[0] || {};
    return {
      ...shared,
      produto: first.produto,
      quantidade: first.quantidade,
      input: first.input,
      arteFinalModo: first.arteFinalModo,
      arteFinalValor: first.arteFinalValor,
      arteFinalFicheiro: first.arteFinalFicheiro,
      arteFinalNome: first.arteFinalNome,
      itens: itensPayload,
    };
  }, [sharedPayload, itens]);

  // cálculo em tempo real (todos os produtos)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const results = await Promise.all(
          itens.map(async (it) => {
            try {
              const r = await fetch('/api/grafica/calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  produto: it.produto,
                  input: buildItemInput(it),
                  quantidade: Number(it.quantidade) || 0,
                  tipoCliente: form.tipoCliente,
                  entrega24h: form.entrega24h,
                  descontoManual: form.descontoManual !== '' && !isNaN(Number(form.descontoManual)) ? Number(form.descontoManual) / 100 : null,
                  tipoOrcamento: form.tipoOrcamento,
                }),
              });
              const d = await r.json();
              return r.ok ? d : null;
            } catch {
              return null;
            }
          })
        );
        setCalcs(results);
      } finally {
        setCalcLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, form.tipoCliente, form.entrega24h, form.descontoManual, form.tipoOrcamento, loading]);

  const guardar = async (estadoForcado?: string) => {
    if (itens.some((it) => !it.quantidade || Number(it.quantidade) <= 0)) {
      toast.error('Indique uma quantidade válida em todos os produtos');
      return;
    }
    // Sem cliente registado: exigir os mesmos dados que o Moloni precisa de um cliente.
    if (!form.clienteId) {
      const emFalta: string[] = [];
      if (!form.clienteEmpresa || !form.clienteEmpresa.trim()) emFalta.push('Nome / Empresa');
      if (!form.clienteNif || !form.clienteNif.trim()) emFalta.push('NIF');
      if (!form.clienteEmail || !form.clienteEmail.trim()) emFalta.push('Email');
      if (!form.clienteTelefone || !form.clienteTelefone.trim()) emFalta.push('Telefone');
      if (!form.clienteMorada || !form.clienteMorada.trim()) emFalta.push('Morada');
      if (emFalta.length) {
        toast.error(`Sem cliente registado, preencha os dados do cliente: ${emFalta.join(', ')}`);
        return;
      }
    }
    setSaving(true);
    try {
      const url = orcamentoId ? `/api/grafica/orcamentos/${orcamentoId}` : '/api/grafica/orcamentos';
      const method = orcamentoId ? 'PUT' : 'POST';
      const payload = buildPayload();
      if (estadoForcado) payload.estado = estadoForcado;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      const rascunho = (estadoForcado || payload.estado) === 'rascunho';
      toast.success(rascunho ? 'Rascunho guardado' : (orcamentoId ? 'Orçamento atualizado' : 'Orçamento criado'));
      router.push(`/orcamentos-graficos/${d.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (i: number, patch: any) => setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItens((arr) => (arr.length >= MAX_ITENS ? arr : [...arr, novoItemProduto(config)]));
  const removeItem = (i: number) => setItens((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const addOpcao = () => setForm((f: any) => ({ ...f, opcoesExtra: [...(f.opcoesExtra || []), { descricao: '', valor: '', incluida: false }] }));
  const updateOpcao = (i: number, patch: any) => setForm((f: any) => ({ ...f, opcoesExtra: (f.opcoesExtra || []).map((o: any, idx: number) => idx === i ? { ...o, ...patch } : o) }));
  const removeOpcao = (i: number) => setForm((f: any) => ({ ...f, opcoesExtra: (f.opcoesExtra || []).filter((_: any, idx: number) => idx !== i) }));

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';
  const semCliente = !form.clienteId;

  const temIva = tipoTemIva(form.tipoOrcamento);
  const iva = temIva ? (config.iva || 0.23) : 0;

  // Somatórios de produtos.
  const somaProdutosSemIva = calcs.reduce((s, c) => s + (c?.precoSemIva || 0), 0);
  const somaProdutosComIva = calcs.reduce((s, c) => s + (c?.precoComIva || 0), 0);

  // Extras do documento: arte-final (por produto) + opções incluídas + portes.
  const arteTotal = itens.reduce((s, it) => {
    const av = it.arteFinalValor !== '' && !isNaN(Number(it.arteFinalValor)) ? Number(it.arteFinalValor) : arteFinalValorSugerido(it.arteFinalModo, config);
    return s + (av > 0 ? av : 0);
  }, 0);
  const opcoesTotal = (form.opcoesExtra || []).filter((o: any) => o.incluida && Number(o.valor) > 0).reduce((s: number, o: any) => s + (Number(o.valor) || 0), 0);
  const portesVal = form.tipoPortes !== 'levantamento' && form.portesEnvio !== '' && !isNaN(Number(form.portesEnvio)) ? Number(form.portesEnvio) : 0;
  const desl = normalizarDeslocacao(form.deslocacao?.incluir
    ? { incluir: true, distanciaKm: Number(form.deslocacao.distanciaKm) || 0, custoKm: Number(form.deslocacao.custoKm) || 0, numTecnicos: Number(form.deslocacao.numTecnicos) || 0, horas: Number(form.deslocacao.horas) || 0, custoHora: Number(form.deslocacao.custoHora) || 0 }
    : null);
  const deslocacaoVal = desl?.valor || 0;
  const extras = arteTotal + opcoesTotal + portesVal + deslocacaoVal;

  const totalDocSemIva = somaProdutosSemIva + extras;
  const totalDocComIva = somaProdutosComIva + extras * (1 + iva);
  const totalDoc = temIva ? totalDocComIva : totalDocSemIva;

  const algumAbaixoMargem = calcs.some((c) => c?.abaixoMargemMinima);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* FORM */}
      <div className="lg:col-span-2 space-y-5">
        {/* BLOCO 1 — CLIENTE */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">1. Cliente</h3>
          <div>
            <label className={labelCls}>Cliente registado (opcional)</label>
            <select
              value={form.clienteId}
              onChange={(e) => {
                const id = e.target.value;
                const c = clientes.find((x) => x.id === id);
                setForm((f: any) => ({
                  ...f,
                  clienteId: id,
                  clienteEmpresa: c ? (c.nome || f.clienteEmpresa) : f.clienteEmpresa,
                  clienteNome: c ? (c.contactoNome || f.clienteNome) : f.clienteNome,
                  clienteNif: c ? (c.nif || f.clienteNif) : f.clienteNif,
                  clienteEmail: c ? (c.email || f.clienteEmail) : f.clienteEmail,
                  clienteTelefone: c ? (c.telefone || f.clienteTelefone) : f.clienteTelefone,
                  clienteMorada: c ? (c.morada || f.clienteMorada) : f.clienteMorada,
                  clienteCodigoPostal: c ? (c.codigoPostal || f.clienteCodigoPostal) : f.clienteCodigoPostal,
                  clienteCidade: c ? (c.cidade || f.clienteCidade) : f.clienteCidade,
                  clienteContacto: c ? ([c.telefone, c.email].filter(Boolean).join(' · ') || f.clienteContacto) : f.clienteContacto,
                }));
              }}
              className={inputCls}
            >
              <option value="">— Sem cliente registado —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {semCliente ? (
              <p className="text-[11px] text-muted-foreground mt-1">Sem cliente registado: preencha abaixo os mesmos dados exigidos para um cliente no Moloni. Os campos assinalados com <span className="text-rose-600">*</span> são obrigatórios.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Dados preenchidos a partir da ficha do cliente registado. Para os alterar, edite a ficha do cliente.</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Nome / Empresa {semCliente && <span className="text-rose-600">*</span>}</label>
            <input
              value={form.clienteEmpresa}
              onChange={(e) => setForm({ ...form, clienteEmpresa: e.target.value })}
              placeholder="Ex.: Criaconsensos, Lda. ou João Silva"
              className={inputCls}
              disabled={!semCliente}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Pessoa de contacto (opcional)</label>
              <input
                value={form.clienteNome}
                onChange={(e) => setForm({ ...form, clienteNome: e.target.value })}
                placeholder="Ex.: João Silva"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
            <div>
              <label className={labelCls}>NIF {semCliente && <span className="text-rose-600">*</span>}</label>
              <input
                value={form.clienteNif}
                onChange={(e) => setForm({ ...form, clienteNif: e.target.value })}
                placeholder="Ex.: 501234567"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email {semCliente && <span className="text-rose-600">*</span>}</label>
              <input
                type="email"
                value={form.clienteEmail}
                onChange={(e) => setForm({ ...form, clienteEmail: e.target.value })}
                placeholder="Ex.: nome@email.pt"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
            <div>
              <label className={labelCls}>Telefone {semCliente && <span className="text-rose-600">*</span>}</label>
              <input
                value={form.clienteTelefone}
                onChange={(e) => setForm({ ...form, clienteTelefone: e.target.value })}
                placeholder="Ex.: 912 345 678"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Morada {semCliente && <span className="text-rose-600">*</span>}</label>
            <input
              value={form.clienteMorada}
              onChange={(e) => setForm({ ...form, clienteMorada: e.target.value })}
              placeholder="Ex.: Rua das Flores, n.º 10"
              className={inputCls}
              disabled={!semCliente}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código postal</label>
              <input
                value={form.clienteCodigoPostal}
                onChange={(e) => setForm({ ...form, clienteCodigoPostal: e.target.value })}
                placeholder="Ex.: 1000-001"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
            <div>
              <label className={labelCls}>Localidade</label>
              <input
                value={form.clienteCidade}
                onChange={(e) => setForm({ ...form, clienteCidade: e.target.value })}
                placeholder="Ex.: Lisboa"
                className={inputCls}
                disabled={!semCliente}
              />
            </div>
          </div>
        </div>

        {/* BLOCO 2 — TIPO DE ORÇAMENTO */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">2. Tipo de Orçamento</h3>
          <div>
            <label className={labelCls}>Tipo de orçamento</label>
            <select value={form.tipoOrcamento} onChange={(e) => setForm({ ...form, tipoOrcamento: e.target.value })} className={inputCls}>
              {TIPOS_ORCAMENTO.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {TIPOS_ORCAMENTO.find((t) => t.id === form.tipoOrcamento)?.descricao}
            </p>
          </div>
        </div>

        {/* BLOCO 3 — PRODUTOS (uma linha por produto) */}
        {itens.map((it, i) => (
          <ProdutoItem
            key={i}
            index={i}
            total={itens.length}
            item={it}
            onChange={(patch) => updateItem(i, patch)}
            onRemove={() => removeItem(i)}
            config={config}
            calc={calcs[i] || null}
            calcLoading={calcLoading}
          />
        ))}

        {itens.length < MAX_ITENS && (
          <button
            type="button"
            onClick={addItem}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar outro produto
          </button>
        )}

        {/* CONDIÇÕES COMERCIAIS (partilhadas) */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Condições Comerciais</h3>
          <p className="text-[11px] text-muted-foreground -mt-2">Aplicam-se a todos os produtos da proposta.</p>
          <div>
            <label className={labelCls}>Tipo de cliente</label>
            <select value={form.tipoCliente} onChange={(e) => setForm({ ...form, tipoCliente: e.target.value })} className={inputCls}>
              {config.descontosCliente.map((d: any) => (
                <option key={d.tipo} value={d.tipo}>{d.label} ({pct(d.desconto)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Prazo de produção</label>
            <select
              value={form.entrega24h ? 'urgente' : (form.prazoManual ? 'manual' : 'normal')}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'urgente') setForm({ ...form, entrega24h: true, prazoManual: false, prazoProducao: '' });
                else if (v === 'manual') setForm({ ...form, entrega24h: false, prazoManual: true });
                else setForm({ ...form, entrega24h: false, prazoManual: false, prazoProducao: '' });
              }}
              className={inputCls}
            >
              <option value="normal">Produção em 4-5 dias úteis</option>
              <option value="urgente">Produção Urgente 24H (+{pct(config.sobretaxa24h)})</option>
              <option value="manual">Prazo personalizado (indicar manualmente)</option>
            </select>
            {form.prazoManual && (
              <input
                value={form.prazoProducao}
                onChange={(e) => setForm({ ...form, prazoProducao: e.target.value })}
                placeholder="Ex.: 10 dias úteis, a acordar, entrega até 30/07…"
                className={inputCls + ' mt-2'}
              />
            )}
            {form.prazoManual && (
              <p className="text-[11px] text-muted-foreground mt-1">Este prazo é indicado manualmente e aparece no orçamento (sem sobretaxa).</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Desconto manual (%) — opcional (substitui o do tipo de cliente)</label>
            <input type="number" value={form.descontoManual} onChange={(e) => setForm({ ...form, descontoManual: e.target.value })} placeholder="—" className={inputCls} />
            {form.descontoManual !== '' && !isNaN(Number(form.descontoManual)) && (
              <p className="text-[11px] text-amber-600 mt-1">
                Atenção: com o desconto manual preenchido ({Number(form.descontoManual)}%), o desconto do tipo de cliente é ignorado. Deixe este campo em branco para aplicar o desconto do tipo de cliente.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Portes / entrega</label>
            <select value={form.tipoPortes} onChange={(e) => setForm({ ...form, tipoPortes: e.target.value })} className={inputCls}>
              <option value="levantamento">Levantar no armazém</option>
              <option value="envio">Portes de Envio</option>
              <option value="envio24h">Portes de envio 24H</option>
            </select>
          </div>
          {form.tipoPortes !== 'levantamento' && (
            <div>
              <label className={labelCls}>Valor dos portes (€)</label>
              <input type="number" step="0.01" value={form.portesEnvio} onChange={(e) => setForm({ ...form, portesEnvio: e.target.value })} placeholder="—" className={inputCls} />
            </div>
          )}
          {/* Deslocação / montagem no cliente */}
          <div className="rounded-xl border border-border p-3 bg-muted/20 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={!!form.deslocacao?.incluir}
                onChange={(e) => {
                  const on = e.target.checked;
                  setForm((f: any) => ({
                    ...f,
                    deslocacao: on
                      ? {
                          ...f.deslocacao,
                          incluir: true,
                          custoKm: f.deslocacao?.custoKm !== '' && f.deslocacao?.custoKm != null ? f.deslocacao.custoKm : String(config?.vinil?.aplicCustoKm ?? 0.4),
                          custoHora: f.deslocacao?.custoHora !== '' && f.deslocacao?.custoHora != null ? f.deslocacao.custoHora : String(config?.vinil?.aplicCustoMaoObraHora ?? 20),
                        }
                      : { incluir: false, distanciaKm: '', custoKm: '', numTecnicos: '', horas: '', custoHora: '' },
                  }));
                }}
                className="h-4 w-4 accent-emerald-600"
              />
              Incluir deslocação / montagem no cliente
            </label>
            <p className="text-[11px] text-muted-foreground -mt-1">Custo de deslocação (kms) e mão de obra da equipa para entrega e/ou montagem no local do cliente. É somado ao total do documento.</p>
            {form.deslocacao?.incluir && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Distância — km (ida + volta)</label>
                    <input type="number" step="1" min={0} value={form.deslocacao.distanciaKm} onChange={(e) => setForm((f: any) => ({ ...f, deslocacao: { ...f.deslocacao, distanciaKm: e.target.value } }))} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Custo por km (€/km)</label>
                    <input type="number" step="0.01" min={0} value={form.deslocacao.custoKm} onChange={(e) => setForm((f: any) => ({ ...f, deslocacao: { ...f.deslocacao, custoKm: e.target.value } }))} placeholder="0,40" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nº de técnicos / homens</label>
                    <input type="number" step="1" min={0} value={form.deslocacao.numTecnicos} onChange={(e) => setForm((f: any) => ({ ...f, deslocacao: { ...f.deslocacao, numTecnicos: e.target.value } }))} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Horas de trabalho (por técnico)</label>
                    <input type="number" step="0.5" min={0} value={form.deslocacao.horas} onChange={(e) => setForm((f: any) => ({ ...f, deslocacao: { ...f.deslocacao, horas: e.target.value } }))} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Custo mão de obra (€/hora)</label>
                    <input type="number" step="0.01" min={0} value={form.deslocacao.custoHora} onChange={(e) => setForm((f: any) => ({ ...f, deslocacao: { ...f.deslocacao, custoHora: e.target.value } }))} placeholder="20,00" className={inputCls} />
                  </div>
                </div>
                {desl && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                    <div>Deslocação: {desl.distanciaKm} km × {formatCurrency(desl.custoKm)}/km = <b>{formatCurrency(desl.custoDeslocacao)}</b></div>
                    <div>Mão de obra: {desl.numTecnicos} × {desl.horas}h × {formatCurrency(desl.custoHora)}/h = <b>{formatCurrency(desl.custoMaoObra)}</b></div>
                    <div className="text-emerald-700 font-medium">Total deslocação / montagem: {formatCurrency(desl.valor)}</div>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className={labelCls}>Descrição do trabalho</label>
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={4} placeholder="Ex.: Cartões de visita a cores, frente e verso, papel couché 350g, cantos redondos…" className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1">Nota interna do trabalho (não é impressa no PDF do orçamento).</p>
          </div>
        </div>

        {/* OPÇÕES PARA O CLIENTE DECIDIR (partilhadas) */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Opções para o cliente decidir</h3>
            <button type="button" onClick={addOpcao} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-input bg-background hover:bg-muted text-xs font-medium">
              <Plus className="h-3.5 w-3.5" /> Adicionar linha
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">Linhas opcionais que aparecem no orçamento para o cliente escolher (ex.: logo fornecido pelo cliente 0€, criação de raiz +X€, adaptação +X€). Marque “Incluir no total” para somar o valor ao total do documento.</p>
          {(form.opcoesExtra || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sem opções. Clique em “Adicionar linha” para criar opções para o cliente decidir.</p>
          )}
          <div className="space-y-3">
            {(form.opcoesExtra || []).map((op: any, i: number) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/20">
                <div className="flex items-start gap-2">
                  <input
                    value={op.descricao}
                    onChange={(e) => updateOpcao(i, { descricao: e.target.value })}
                    placeholder="Ex.: Criação de logotipo de raiz"
                    className={inputCls + ' flex-1'}
                  />
                  <button type="button" onClick={() => removeOpcao(i)} className="p-2 rounded-lg border border-input bg-background hover:bg-red-50 text-red-600" title="Remover linha">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Valor (€)</span>
                    <input type="number" step="0.01" min={0} value={op.valor} onChange={(e) => updateOpcao(i, { valor: e.target.value })} placeholder="0,00" className={inputCls + ' w-28'} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!op.incluida} onChange={(e) => updateOpcao(i, { incluida: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                    Incluir no total
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => guardar()}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {orcamentoId ? 'Guardar Alterações' : 'Criar Orçamento'}
          </button>
          <button
            onClick={() => guardar('rascunho')}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium transition-colors disabled:opacity-60"
          >
            <FileEdit className="h-4 w-4" /> Guardar como rascunho
          </button>
          <p className="text-[11px] text-muted-foreground text-center">O rascunho fica guardado e pode continuar a editar e acrescentar o que precisar a qualquer momento.</p>
        </div>
      </div>

      {/* PREVIEW / PROPOSTA */}
      <div className="lg:col-span-3">
        <div className="sticky top-4 space-y-4">
          {algumAbaixoMargem && (
            <motion.div initial={false} className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <b>Margem abaixo do mínimo</b> ({pct(config.margemMinima)}) num dos produtos. Reveja o desconto ou a quantidade.
              </div>
            </motion.div>
          )}

          <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Proposta ({itens.length} {itens.length === 1 ? 'produto' : 'produtos'})</h3>
              {calcLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
            </div>

            {/* Linhas por produto */}
            <table className="w-full text-sm mb-4">
              <tbody>
                {itens.map((it, i) => {
                  const c = calcs[i];
                  const av = it.arteFinalValor !== '' && !isNaN(Number(it.arteFinalValor)) ? Number(it.arteFinalValor) : arteFinalValorSugerido(it.arteFinalModo, config);
                  return (
                    <tr key={i} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-foreground">{produtoLabel(it.produto)}</div>
                        <div className="text-xs text-muted-foreground">{it.quantidade} un.{c ? ` · ${formatCurrency(c.precoUnitario)}/un.` : ''}</div>
                        {av > 0 ? (
                          <div className="text-[11px] text-muted-foreground">Arte-final: +{formatCurrency(av)}</div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">Arte-final: ficheiro do cliente</div>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">{c ? formatCurrency(c.precoSemIva) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Extras do documento */}
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal produtos</span>
                <span className="font-medium">{formatCurrency(somaProdutosSemIva)}</span>
              </div>
              {arteTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arte-final (total)</span>
                  <span className="font-medium">{formatCurrency(arteTotal)}</span>
                </div>
              )}
              {(form.opcoesExtra || []).filter((o: any) => o.incluida && Number(o.valor) > 0).map((o: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{o.descricao || 'Opção'}</span>
                  <span className="font-medium">+{formatCurrency(Number(o.valor) || 0)}</span>
                </div>
              ))}
              {portesVal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Portes</span>
                  <span className="font-medium">{formatCurrency(portesVal)}</span>
                </div>
              )}
              {deslocacaoVal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deslocação / montagem</span>
                  <span className="font-medium">+{formatCurrency(deslocacaoVal)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground space-y-0.5">
                {(() => {
                  const manual = form.descontoManual !== '' && !isNaN(Number(form.descontoManual));
                  const eff = calcs[0]?.descontoCliente || 0;
                  if (eff <= 0) return null;
                  if (manual) return <div>Desconto manual: {pct(eff)} <span className="text-amber-600">(substitui o tipo de cliente)</span></div>;
                  const lbl = config.descontosCliente.find((d: any) => d.tipo === form.tipoCliente)?.label || 'cliente';
                  return <div>Desconto {lbl}: {pct(eff)}</div>;
                })()}
                {calcs[0]?.sobretaxa24h > 0 && <div>Sobretaxa 24h: +{pct(calcs[0].sobretaxa24h)}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{temIva ? 'Total s/IVA' : 'Total (sem IVA)'}</div>
                <div className="text-2xl font-bold text-emerald-700">{formatCurrency(totalDocSemIva)}</div>
                {temIva ? (
                  <div className="text-xs text-muted-foreground">c/IVA: {formatCurrency(totalDocComIva)}</div>
                ) : (
                  <div className="text-xs text-amber-600 font-medium">ONF — sem IVA (controlo interno)</div>
                )}
                {extras > 0 && (
                  <div className="mt-1 pt-1 border-t border-border text-xs">
                    <span className="text-muted-foreground">Total geral: </span>
                    <b className="text-emerald-700">{formatCurrency(totalDoc)}</b>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de preços por quantidade — apenas com 1 produto */}
          {itens.length === 1 && calcs[0] && itens[0].produto !== 'contratar' && (
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h3 className="text-sm font-semibold mb-3">Tabela de Preços por Quantidade</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Qtd</th>
                      <th className="text-right py-2 font-medium">{(itens[0].produto === 'stickers' || itens[0].produto === 'vinil') ? 'Subst.' : 'Papel'}</th>
                      <th className="text-right py-2 font-medium">{(itens[0].produto === 'stickers' || itens[0].produto === 'vinil') ? 'Tinta' : 'Impr.'}</th>
                      <th className="text-right py-2 font-medium">{(itens[0].produto === 'stickers' || itens[0].produto === 'vinil') ? 'Máq.' : 'Pré-imp.'}</th>
                      <th className="text-right py-2 font-medium">{(itens[0].produto === 'stickers' || itens[0].produto === 'vinil') ? 'Corte' : 'Acab.'}</th>
                      <th className="text-right py-2 font-medium">s/IVA</th>
                      <th className="text-right py-2 font-medium">Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcs[0].tabela.map((l: any) => (
                      <tr key={l.quantidade} className={`border-b border-border/50 ${l.quantidade === Number(itens[0].quantidade) ? 'bg-emerald-50' : ''}`}>
                        <td className="py-1.5 font-medium">{l.quantidade}</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.custoPapel)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.custoImpressao)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.custoPreImp)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.custoCorte + l.custoVinco + l.custoLaminacoes)}</td>
                        <td className="py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(l.precoSemIva)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.precoUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
