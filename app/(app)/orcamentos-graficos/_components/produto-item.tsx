'use client';

import { useState } from 'react';
import { Loader2, Upload, FileCheck2, X, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ARTE_FINAL_OPCOES, arteFinalValorSugerido } from '@/lib/grafica/arte-final';
import { UNIDADES_ARTIGO, labelUnidadeArtigo } from '@/lib/grafica/substrato-categorias';
import { laminacoesVinil, isPlacaRigida } from '@/lib/grafica/produtos/vinil';
import { toast } from 'sonner';

// Catálogo de produtos do módulo de orçamentos.
// `disponivel: false` → aparece na lista como "(em breve)" mas não é selecionável.
export const PRODUTOS: { id: string; label: string; disponivel: boolean }[] = [
  { id: 'cartoes', label: 'Cartões Comerciais', disponivel: true },
  { id: 'stickers', label: 'Stickers / Adesivos', disponivel: true },
  { id: 'contratar', label: 'Contratar (Subcontratação)', disponivel: true },
  { id: 'livre', label: 'Produto em Branco (texto livre)', disponivel: true },
  { id: 'artigo', label: 'Artigo / Acessório', disponivel: true },
  { id: 'imp_peq_formato', label: 'Flyers', disponivel: true },
  { id: 'vinil', label: 'Impressão digital de grande formato', disponivel: true },
  { id: 'impressao_3d', label: 'Impressão 3D', disponivel: false },
];

export function produtoLabel(id: string) {
  return PRODUTOS.find((p) => p.id === id)?.label || id;
}

// Garante que o id do corte (cartões) existe na lista da configuração.
// Ids legados ('guilhotina', 'cantos', ...) são mapeados por texto; sem correspondência → 'nenhum'.
function resolveCorteId(id: string | null | undefined, cortes: any[] | undefined): string {
  if (!id || id === 'nenhum') return 'nenhum';
  const lista = cortes || [];
  if (!lista.length) return id;
  if (lista.some((c) => c.id === id)) return id;
  const alvo = id.toLowerCase();
  const m = lista.find((c) => String(c.id).toLowerCase() === alvo || String(c.nome || '').toLowerCase().includes(alvo));
  return m ? m.id : 'nenhum';
}

// Estado por defeito de um produto (linha do orçamento).
export function novoItemProduto(config?: any): any {
  return {
    produto: 'cartoes',
    papelId: config?.papeis?.[0]?.id || 'P1',
    larguraMm: 85,
    alturaMm: 55,
    sangriaMm: 3,
    quantidade: 500,
    frenteVerso: true,
    cor: true,
    corVerso: true,
    tipoCorte: resolveCorteId('guilhotina', config?.cortes),
    vinco: false,
    laminacoes: [] as string[],
    coberturaTinta: '100',
    substratoId: 'S3',
    stickerMaquina: 'auto',
    stickerCorte: 'Recorte personalizado',
    stickerLaminacao: false,
    stickerLaminacaoId: '',
    stickerAplicacao: '',
    contratarDescricao: '',
    contratarFornecedor: '',
    contratarCustoUnitario: '',
    contratarMarkup: '40',
    livreDescricao: '',
    livrePreco: '',
    artigoId: '',
    artigoDescricao: '',
    artigoUnidade: 'un',
    artigoCusto: '',
    artigoMarkup: '50',
    flyerPapelId: 'P19',
    flyerFormato: 'A5',
    flyerTipoFlyer: 'monofolha',
    flyerCorteGuilhotina: true,
    flyerVincar: false,
    flyerAcabamentos: [] as string[],
    vinilSubstratoId: 'S15',
    vinilBleed: '5',
    vinilCobertura: '90',
    vinilAcabamento: 'Apenas corte',
    vinilAplicacao: 'Indoor',
    vinilAplicacaoNoLocal: false,
    vinilImprimir: true,
    vinilMargemOverride: '',
    vinilNCores: '4',
    vinilLaminacaoId: '',
    vinilRecorteContorno: false,
    vinilPelicula: false,
    vinilAplicacaoSubstrato: false,
    vinilSuporteRigidoId: '',
    vinilNIlhoses: '0',
    vinilMetrosBiadesivo: '0',
    vinilIlhoses: false,
    vinilBiadesivo: false,
    vinilAplicKm: '35',
    vinilAplicFunc: '2',
    vinilAplicHoras: '0.45',
    arteFinalModo: 'cliente',
    arteFinalValor: '',
    arteFinalFicheiro: '',
    arteFinalNome: '',
  };
}

// Constrói o `input` de cálculo a partir de um item (produto-específico).
export function buildItemInput(item: any): any {
  return item.produto === 'livre'
    ? {
        descricao: item.livreDescricao || '',
        precoUnitario:
          item.livrePreco !== '' && !isNaN(Number(item.livrePreco))
            ? Number(item.livrePreco)
            : 0,
      }
    : item.produto === 'artigo'
    ? {
        artigoId: item.artigoId || null,
        descricao: item.artigoDescricao || '',
        unidade: item.artigoUnidade || 'un',
        custoUnitario:
          item.artigoCusto !== '' && !isNaN(Number(item.artigoCusto)) ? Number(item.artigoCusto) : 0,
        markup:
          item.artigoMarkup !== '' && !isNaN(Number(item.artigoMarkup)) ? Number(item.artigoMarkup) / 100 : 0,
      }
    : item.produto === 'contratar'
    ? {
        descricao: item.contratarDescricao || '',
        fornecedor: item.contratarFornecedor || null,
        custoUnitario:
          item.contratarCustoUnitario !== '' && !isNaN(Number(item.contratarCustoUnitario))
            ? Number(item.contratarCustoUnitario)
            : 0,
        markup:
          item.contratarMarkup !== '' && !isNaN(Number(item.contratarMarkup))
            ? Number(item.contratarMarkup) / 100
            : 0,
      }
    : item.produto === 'imp_peq_formato'
    ? {
        papelId: item.flyerPapelId,
        formato: item.flyerFormato,
        larguraMm: Number(item.larguraMm) || 0,
        alturaMm: Number(item.alturaMm) || 0,
        frenteVerso: item.frenteVerso,
        corFrente: item.cor,
        corVerso: item.corVerso,
        tipoFlyer: item.flyerTipoFlyer,
        corteGuilhotina: item.flyerCorteGuilhotina,
        vincar: item.flyerVincar,
        acabamentos: item.flyerAcabamentos,
      }
    : item.produto === 'vinil'
    ? {
        larguraMm: Number(item.larguraMm) || 0,
        alturaMm: Number(item.alturaMm) || 0,
        bleedMm: Number(item.vinilBleed) || 0,
        coberturaTinta:
          item.vinilCobertura !== '' && !isNaN(Number(item.vinilCobertura))
            ? Number(item.vinilCobertura) / 100
            : 0.9,
        substratoId: item.vinilSubstratoId,
        aplicacao: item.vinilAplicacao || null,
        acabamento: item.vinilAcabamento,
        aplicacaoNoLocal: item.vinilAplicacaoNoLocal,
        imprimir: true,
        margemOverride:
          item.vinilMargemOverride !== '' && !isNaN(Number(item.vinilMargemOverride))
            ? Number(item.vinilMargemOverride) / 100
            : null,
        nCores: 4,
        laminacaoId: item.vinilLaminacaoId || null,
        recorteContorno: !!item.vinilRecorteContorno,
        pelicula: !!item.vinilPelicula,
        aplicacaoSubstrato: false,
        suporteRigidoId: null,
        ilhoses: !!item.vinilIlhoses,
        biadesivo: !!item.vinilBiadesivo,
        nIlhoses: Number(item.vinilNIlhoses) || 0,
        metrosBiadesivo: Number(item.vinilMetrosBiadesivo) || 0,
        aplicKm: Number(item.vinilAplicKm) || 0,
        aplicFuncionarios: Number(item.vinilAplicFunc) || 0,
        aplicHoras: Number(item.vinilAplicHoras) || 0,
      }
    : item.produto === 'stickers'
    ? {
        larguraMm: Number(item.larguraMm) || 0,
        alturaMm: Number(item.alturaMm) || 0,
        sangriaMm: Number(item.sangriaMm) || 0,
        coberturaTinta:
          item.coberturaTinta !== '' && !isNaN(Number(item.coberturaTinta))
            ? Number(item.coberturaTinta) / 100
            : 1,
        cor: item.cor,
        substratoId: item.substratoId,
        maquinaModo: item.stickerMaquina || 'auto',
        aplicacao: item.stickerAplicacao || null,
        tipoCorte: item.stickerCorte,
        laminacaoId: item.stickerLaminacaoId || '',
        laminacao: !!item.stickerLaminacaoId,
      }
    : {
        papelId: item.papelId,
        larguraMm: Number(item.larguraMm) || 0,
        alturaMm: Number(item.alturaMm) || 0,
        sangriaMm: Number(item.sangriaMm) || 0,
        frenteVerso: item.frenteVerso,
        cor: item.cor,
        tipoCorte: item.tipoCorte,
        vinco: item.vinco,
        laminacoes: item.laminacoes,
      };
}

// Constrói o objeto item a enviar no payload (campos comerciais partilhados ficam no documento).
export function buildItemPayload(item: any): any {
  return {
    produto: item.produto,
    quantidade: Number(item.quantidade) || 0,
    input: buildItemInput(item),
    arteFinalModo: item.arteFinalModo,
    arteFinalValor: item.arteFinalValor !== '' && !isNaN(Number(item.arteFinalValor)) ? Number(item.arteFinalValor) : null,
    arteFinalFicheiro: item.arteFinalModo === 'cliente' ? (item.arteFinalFicheiro || null) : null,
    arteFinalNome: item.arteFinalModo === 'cliente' ? (item.arteFinalNome || null) : null,
  };
}

// Hidrata um item de formulário a partir de dados guardados (item novo OU topo legado).
export function itemFromStored(s: any, cfg: any): any {
  const esp = s.especificacoes || {};
  const produto = s.produto || 'cartoes';
  return {
    produto,
    papelId: esp.papelId || cfg?.papeis?.[0]?.id || 'P1',
    larguraMm: esp.larguraMm ?? 85,
    alturaMm: esp.alturaMm ?? 55,
    sangriaMm: esp.sangriaMm ?? 3,
    quantidade: s.quantidade ?? 500,
    frenteVerso: !!esp.frenteVerso,
    cor: produto === 'imp_peq_formato' ? esp.corFrente !== false : esp.cor !== false,
    corVerso: produto === 'imp_peq_formato' ? esp.corVerso !== false : true,
    flyerPapelId: (produto === 'imp_peq_formato' ? esp.papelId : '') || 'P19',
    flyerFormato: (produto === 'imp_peq_formato' ? esp.formato : '') || 'A5',
    flyerTipoFlyer: (produto === 'imp_peq_formato' ? esp.tipoFlyer : '') || 'monofolha',
    flyerCorteGuilhotina: produto === 'imp_peq_formato' ? esp.corteGuilhotina !== false : true,
    flyerVincar: produto === 'imp_peq_formato' ? esp.vincar === true : false,
    flyerAcabamentos: produto === 'imp_peq_formato' ? (esp.acabamentos || []) : [],
    vinilSubstratoId: (produto === 'vinil' ? esp.substratoId : '') || 'S15',
    vinilBleed: produto === 'vinil' && esp.bleedMm != null ? String(esp.bleedMm) : '5',
    vinilCobertura: produto === 'vinil' && esp.coberturaTinta != null ? String(Math.round(esp.coberturaTinta * 100)) : '90',
    vinilAcabamento: (produto === 'vinil' ? esp.acabamento : '') || 'Apenas corte',
    vinilAplicacao: (produto === 'vinil' ? esp.aplicacao : '') || 'Indoor',
    vinilAplicacaoNoLocal: produto === 'vinil' ? !!esp.aplicacaoNoLocal : false,
    vinilImprimir: produto === 'vinil' ? esp.imprimir !== false : true,
    vinilMargemOverride: produto === 'vinil' && esp.margemOverride != null ? String(Math.round(esp.margemOverride * 100)) : '',
    vinilNCores: produto === 'vinil' && esp.nCores != null ? String(esp.nCores) : '4',
    vinilLaminacaoId: (produto === 'vinil' ? esp.laminacaoId : '') || '',
    vinilRecorteContorno: produto === 'vinil' ? !!esp.recorteContorno : false,
    vinilPelicula: produto === 'vinil' ? !!esp.pelicula : false,
    vinilAplicacaoSubstrato: produto === 'vinil' ? !!esp.aplicacaoSubstrato : false,
    vinilSuporteRigidoId: (produto === 'vinil' ? esp.suporteRigidoId : '') || '',
    vinilNIlhoses: produto === 'vinil' && esp.nIlhoses != null ? String(esp.nIlhoses) : '0',
    vinilMetrosBiadesivo: produto === 'vinil' && esp.metrosBiadesivo != null ? String(esp.metrosBiadesivo) : '0',
    vinilIlhoses: produto === 'vinil' ? !!esp.ilhoses : false,
    vinilBiadesivo: produto === 'vinil' ? !!esp.biadesivo : false,
    vinilAplicKm: produto === 'vinil' && esp.aplicKm != null ? String(esp.aplicKm) : '35',
    vinilAplicFunc: produto === 'vinil' && esp.aplicFuncionarios != null ? String(esp.aplicFuncionarios) : '2',
    vinilAplicHoras: produto === 'vinil' && esp.aplicHoras != null ? String(esp.aplicHoras) : '0.45',
    tipoCorte: resolveCorteId(esp.tipoCorte || 'guilhotina', cfg?.cortes),
    vinco: !!esp.vinco,
    laminacoes: esp.laminacoes || [],
    coberturaTinta: esp.coberturaTinta != null ? String(Math.round(esp.coberturaTinta * 100)) : '100',
    substratoId: esp.substratoId || 'S3',
    stickerMaquina: (produto === 'stickers' ? esp.maquinaModo : null) || 'auto',
    stickerCorte: (() => {
      const guardado = produto === 'stickers' ? esp.tipoCorte : null;
      const lista: any[] = cfg?.stickers?.cortes || [];
      // ids antigos (velocidades mm/s) já não existem → equivalente Excel: recorte personalizado
      if (guardado && (!lista.length || lista.some((c: any) => c.id === guardado))) return guardado;
      return 'Recorte personalizado';
    })(),
    stickerLaminacao: produto === 'stickers' ? !!esp.laminacao : false,
    stickerLaminacaoId:
      produto === 'stickers'
        ? (esp.laminacaoId != null && esp.laminacaoId !== ''
            ? esp.laminacaoId
            : (esp.laminacao ? (cfg?.stickers?.laminacoes?.[0]?.id || '') : ''))
        : '',
    stickerAplicacao: esp.aplicacao || '',
    contratarDescricao: (produto === 'contratar' ? esp.descricao : '') || '',
    contratarFornecedor: (produto === 'contratar' ? esp.fornecedor : '') || '',
    contratarCustoUnitario: produto === 'contratar' && esp.custoUnitario != null ? String(esp.custoUnitario) : '',
    contratarMarkup: produto === 'contratar' && esp.markup != null ? String(Math.round(esp.markup * 100)) : '40',
    livreDescricao: (produto === 'livre' ? esp.descricao : '') || '',
    livrePreco: produto === 'livre' && esp.precoUnitario != null ? String(esp.precoUnitario) : '',
    artigoId: (produto === 'artigo' ? esp.artigoId : '') || '',
    artigoDescricao: (produto === 'artigo' ? esp.descricao : '') || '',
    artigoUnidade: (produto === 'artigo' ? esp.unidade : '') || 'un',
    artigoCusto: produto === 'artigo' && esp.custoUnitario != null ? String(esp.custoUnitario) : '',
    artigoMarkup: produto === 'artigo' && esp.markup != null ? String(Math.round(esp.markup * 100)) : '50',
    arteFinalModo: s.arteFinalModo || 'cliente',
    arteFinalValor: s.arteFinalValor != null ? String(s.arteFinalValor) : '',
    arteFinalFicheiro: s.arteFinalFicheiro || '',
    arteFinalNome: s.arteFinalNome || '',
  };
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

// Paleta de fundos por produto (index cíclico). Strings literais completas
// para o JIT do Tailwind não purgar as classes. Fundos suaves com bom
// contraste em modo claro/escuro; texto continua a usar text-foreground.
const PRODUTO_PALETTES = [
  'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900',
  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
  'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
  'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900',
  'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900',
  'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900',
];

export function ProdutoItem({
  index,
  total,
  item,
  onChange,
  onRemove,
  config,
  calc,
  calcLoading,
}: {
  index: number;
  total: number;
  item: any;
  onChange: (patch: any) => void;
  onRemove: () => void;
  config: any;
  calc: any;
  calcLoading: boolean;
}) {
  const [uploadingArte, setUploadingArte] = useState(false);

  const update = (patch: any) => onChange(patch);

  const isSticker = item.produto === 'stickers';
  const isContratar = item.produto === 'contratar';
  const isFlyer = item.produto === 'imp_peq_formato';
  const isVinil = item.produto === 'vinil';
  const isLivre = item.produto === 'livre';
  const isArtigo = item.produto === 'artigo';
  const artigos = config.artigos || [];
  const vin = config.vinil || {};
  const fly = config.flyers || {};
  const stk = config.stickers || {};
  const stickerCortes = stk.cortes || [];
  const substratos = stk.substratos || [];
  const cortesDisponiveis = (config.cortes || []).filter((c: any) => c.id !== 'vinco');

  const toggleLam = (id: string) =>
    update({ laminacoes: item.laminacoes.includes(id) ? item.laminacoes.filter((x: string) => x !== id) : [...item.laminacoes, id] });
  const toggleFlyerAcab = (id: string) =>
    update({ flyerAcabamentos: item.flyerAcabamentos.includes(id) ? item.flyerAcabamentos.filter((x: string) => x !== id) : [...item.flyerAcabamentos, id] });
  const onSelectArtigo = (id: string) => {
    if (!id) { update({ artigoId: '' }); return; }
    const a = artigos.find((x: any) => x.id === id);
    if (!a) { update({ artigoId: id }); return; }
    update({
      artigoId: id,
      artigoDescricao: a.descricao || '',
      artigoUnidade: a.unidade || 'un',
      artigoCusto: a.custoUnitario != null ? String(a.custoUnitario) : '',
      artigoMarkup: a.markup != null ? String(Math.round(a.markup * 100)) : '50',
    });
  };

  const setArteModo = (modo: string) => {
    update({
      arteFinalModo: modo,
      arteFinalValor: String(arteFinalValorSugerido(modo, config)),
      ...(modo !== 'cliente' ? { arteFinalFicheiro: '', arteFinalNome: '' } : {}),
    });
  };

  const uploadArteFicheiro = async (file?: File) => {
    if (!file) return;
    setUploadingArte(true);
    try {
      const presRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
      });
      const pres = await presRes.json();
      if (!presRes.ok) throw new Error(pres.error || 'Erro');
      await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      update({ arteFinalFicheiro: pres.cloud_storage_path, arteFinalNome: file.name });
      toast.success('Ficheiro do cliente anexado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar ficheiro');
    } finally {
      setUploadingArte(false);
    }
  };

  return (
    <div className={`rounded-2xl shadow-sm border p-5 space-y-4 ${PRODUTO_PALETTES[index % PRODUTO_PALETTES.length]}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Tipo de Trabalho {index + 1}</h3>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-input bg-background hover:bg-red-50 text-red-600 text-xs font-medium" title="Remover produto">
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
      </div>

      {/* TIPO DE TRABALHO */}
      <div>
        <label className={labelCls}>Tipo de Trabalho</label>
        <select
          value={item.produto}
          onChange={(e) => {
            const p = e.target.value;
            update({ produto: p, quantidade: (p === 'contratar' || p === 'livre' || p === 'artigo') && item.produto !== p ? '1' : item.quantidade });
          }}
          className={inputCls}
        >
          {PRODUTOS.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.disponivel}>
              {p.label}{p.disponivel ? '' : ' (em breve)'}
            </option>
          ))}
        </select>
      </div>

      {/* ESPECIFICAÇÕES */}
      <div className="pt-1 border-t border-border/50 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Especificações</p>
        {isContratar && (
          <>
            <div>
              <label className={labelCls}>Descrição do trabalho</label>
              <input value={item.contratarDescricao} onChange={(e) => update({ contratarDescricao: e.target.value })} placeholder="Ex.: Impressão de 500 folhetos A5 (subcontratado)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fornecedor (opcional)</label>
              <input value={item.contratarFornecedor} onChange={(e) => update({ contratarFornecedor: e.target.value })} placeholder="Ex.: Gráfica XPTO" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Custo do fornecedor (€/un.)</label>
                <input type="number" step="0.01" min={0} value={item.contratarCustoUnitario} onChange={(e) => update({ contratarCustoUnitario: e.target.value })} placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Margem a aplicar (%)</label>
                <input type="number" step="1" min={0} value={item.contratarMarkup} onChange={(e) => update({ contratarMarkup: e.target.value })} placeholder="40" className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Preço = custo do fornecedor × (1 + margem). O desconto de cliente, sobretaxa 24h e IVA são aplicados a seguir, tal como nos restantes produtos.</p>
          </>
        )}
        {isLivre && (
          <>
            <div>
              <label className={labelCls}>Descrição (texto livre)</label>
              <textarea value={item.livreDescricao} onChange={(e) => update({ livreDescricao: e.target.value })} rows={4} placeholder="Escreva livremente o trabalho a orçamentar…" className={inputCls + ' resize-y'} />
              <p className="text-[11px] text-muted-foreground mt-1">A 1.ª linha aparece como título da linha no orçamento; as restantes como detalhe.</p>
            </div>
            <div>
              <label className={labelCls}>Preço unitário (€/un., s/IVA)</label>
              <input type="number" step="0.01" min={0} value={item.livrePreco} onChange={(e) => update({ livrePreco: e.target.value })} placeholder="0,00" className={inputCls} />
            </div>
            <p className="text-[11px] text-muted-foreground">Preço totalmente manual (preço unitário × quantidade). O desconto de cliente, sobretaxa 24h e IVA são aplicados a seguir, tal como nos restantes produtos.</p>
          </>
        )}
        {isArtigo && (
          <>
            <div>
              <label className={labelCls}>Artigo / acessório do catálogo</label>
              <select value={item.artigoId || ''} onChange={(e) => onSelectArtigo(e.target.value)} className={inputCls}>
                <option value="">— Escrever manualmente —</option>
                {artigos.filter((a: any) => a.ativo !== false || a.id === item.artigoId).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.id} · {a.descricao} ({labelUnidadeArtigo(a.unidade)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input value={item.artigoDescricao} onChange={(e) => update({ artigoDescricao: e.target.value })} placeholder="Ex.: Distanciador de parede inox 19×30 mm" className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Unidade</label>
                <select value={item.artigoUnidade || 'un'} onChange={(e) => update({ artigoUnidade: e.target.value })} className={inputCls}>
                  {UNIDADES_ARTIGO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Custo (€/un.)</label>
                <input type="number" step="0.01" min={0} value={item.artigoCusto} onChange={(e) => update({ artigoCusto: e.target.value })} placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Margem (%)</label>
                <input type="number" step="1" min={0} value={item.artigoMarkup} onChange={(e) => update({ artigoMarkup: e.target.value })} placeholder="50" className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Preço = custo × quantidade × (1 + margem). A <b>Quantidade</b> abaixo é o número de unidades/kits/metros. O desconto de cliente, sobretaxa 24h e IVA são aplicados a seguir.</p>
          </>
        )}
        {!isSticker && !isContratar && !isFlyer && !isVinil && !isLivre && !isArtigo && (
          <div>
            <label className={labelCls}>Papel</label>
            <select value={item.papelId} onChange={(e) => update({ papelId: e.target.value })} className={inputCls}>
              {config.papeis.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nome} ({p.larguraMm}×{p.alturaMm})</option>
              ))}
            </select>
          </div>
        )}
        {!isSticker && !isContratar && !isFlyer && !isVinil && !isLivre && !isArtigo && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Largura (mm)</label>
              <input type="number" value={item.larguraMm} onChange={(e) => update({ larguraMm: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Altura (mm)</label>
              <input type="number" value={item.alturaMm} onChange={(e) => update({ alturaMm: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sangria (mm)</label>
              <input type="number" value={item.sangriaMm} onChange={(e) => update({ sangriaMm: e.target.value })} className={inputCls} />
            </div>
          </div>
        )}
        {isSticker && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Largura (cm)</label>
              <input
                type="number"
                step="0.1"
                value={item.larguraMm === '' ? '' : Number(item.larguraMm) / 10}
                onChange={(e) => update({ larguraMm: e.target.value === '' ? '' : String(Number(e.target.value) * 10) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Altura (cm)</label>
              <input
                type="number"
                step="0.1"
                value={item.alturaMm === '' ? '' : Number(item.alturaMm) / 10}
                onChange={(e) => update({ alturaMm: e.target.value === '' ? '' : String(Number(e.target.value) * 10) })}
                className={inputCls}
              />
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Quantidade</label>
          <input type="number" value={item.quantidade} onChange={(e) => update({ quantidade: e.target.value })} className={inputCls} />
        </div>
        {!isSticker && !isContratar && !isFlyer && !isVinil && !isLivre && !isArtigo && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Impressão</label>
              <select value={item.frenteVerso ? 'fv' : 'frente'} onChange={(e) => update({ frenteVerso: e.target.value === 'fv' })} className={inputCls}>
                <option value="frente">Só frente</option>
                <option value="fv">Frente e verso</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Cor</label>
              <select value={item.cor ? 'cor' : 'pb'} onChange={(e) => update({ cor: e.target.value === 'cor' })} className={inputCls}>
                <option value="cor">A cores</option>
                <option value="pb">Preto e branco (P&B)</option>
              </select>
            </div>
          </div>
        )}
        {isSticker && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cor</label>
                <select value={item.cor ? 'cor' : 'pb'} onChange={(e) => update({ cor: e.target.value === 'cor' })} className={inputCls}>
                  <option value="cor">A cores (CMYK)</option>
                  <option value="pb">Preto e branco (P&B)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Cobertura de tinta (%)</label>
                <input type="number" min={0} max={100} value={item.coberturaTinta} onChange={(e) => update({ coberturaTinta: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Máquina</label>
                <select
                  value={item.stickerMaquina || 'auto'}
                  onChange={(e) => {
                    const modo = e.target.value;
                    const patch: any = { stickerMaquina: modo };
                    if (modo !== 'auto') {
                      const alvo = modo === 'mutoh' ? 'Mutoh' : 'Xerox';
                      const atual = substratos.find((s: any) => s.id === item.substratoId);
                      if (!atual || atual.maquina !== alvo) {
                        const primeiro = substratos.find((s: any) => s.maquina === alvo);
                        if (primeiro) patch.substratoId = primeiro.id;
                      }
                    }
                    update(patch);
                  }}
                  className={inputCls}
                >
                  <option value="auto">Automático (mais barato)</option>
                  <option value="mutoh">Mutoh (rolo)</option>
                  <option value="xerox">Versant (folha)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Substrato</label>
                <select value={item.substratoId} onChange={(e) => update({ substratoId: e.target.value })} className={inputCls}>
                  {substratos
                    .filter((s: any) => s.ativo !== false || s.id === item.substratoId)
                    .filter((s: any) => {
                      const modo = item.stickerMaquina || 'auto';
                      if (modo === 'mutoh') return s.maquina === 'Mutoh';
                      if (modo === 'xerox') return s.maquina === 'Xerox';
                      return true;
                    })
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>{s.id} · {s.descricao}</option>
                    ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {(item.stickerMaquina || 'auto') === 'auto'
                ? 'Em Automático o sistema compara rolo (Mutoh) e folha (Versant) e escolhe a opção mais barata. O substrato influencia sempre o preço.'
                : 'Máquina forçada. O substrato influencia sempre o preço.'}
            </p>
            <div>
              <label className={labelCls}>Aplicação (opcional)</label>
              <input value={item.stickerAplicacao} onChange={(e) => update({ stickerAplicacao: e.target.value })} placeholder="Ex.: Outdoor, Indoor, Montra…" className={inputCls} />
            </div>
          </>
        )}
        {isFlyer && (
          <>
            <div>
              <label className={labelCls}>Papel</label>
              <select value={item.flyerPapelId} onChange={(e) => update({ flyerPapelId: e.target.value })} className={inputCls}>
                {(fly.papeis || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.tipo} {p.gramagem}g ({p.larguraMm}×{p.alturaMm})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Formato</label>
              <select value={item.flyerFormato} onChange={(e) => update({ flyerFormato: e.target.value })} className={inputCls}>
                <option value="A4">A4 (210×297 mm)</option>
                <option value="A5">A5 (148×210 mm)</option>
                <option value="A6">A6 (105×148 mm)</option>
                <option value="DL">DL (99×210 mm)</option>
                <option value="personalizado">Personalizado…</option>
              </select>
            </div>
            {item.flyerFormato === 'personalizado' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Largura (mm)</label>
                  <input type="number" value={item.larguraMm} onChange={(e) => update({ larguraMm: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Altura (mm)</label>
                  <input type="number" value={item.alturaMm} onChange={(e) => update({ alturaMm: e.target.value })} className={inputCls} />
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>Tipo de flyer</label>
              <select value={item.flyerTipoFlyer} onChange={(e) => update({ flyerTipoFlyer: e.target.value })} className={inputCls}>
                <option value="monofolha">Monofolha (sem dobra)</option>
                <option value="diptico">Díptico (1 dobra)</option>
                <option value="triptico">Tríptico (2 dobras)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Corte reto em guilhotina</label>
                <select value={item.flyerCorteGuilhotina ? 'sim' : 'nao'} onChange={(e) => update({ flyerCorteGuilhotina: e.target.value === 'sim' })} className={inputCls}>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              {item.flyerTipoFlyer !== 'monofolha' && (
                <div>
                  <label className={labelCls}>Vincar antes de dobrar</label>
                  <select value={item.flyerVincar ? 'sim' : 'nao'} onChange={(e) => update({ flyerVincar: e.target.value === 'sim' })} className={inputCls}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Impressão</label>
                <select value={item.frenteVerso ? 'fv' : 'frente'} onChange={(e) => update({ frenteVerso: e.target.value === 'fv' })} className={inputCls}>
                  <option value="frente">Só frente</option>
                  <option value="fv">Frente e verso</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Cor da frente</label>
                <select value={item.cor ? 'cor' : 'pb'} onChange={(e) => update({ cor: e.target.value === 'cor' })} className={inputCls}>
                  <option value="cor">A cores</option>
                  <option value="pb">Preto e branco (P&B)</option>
                </select>
              </div>
            </div>
            {item.frenteVerso && (
              <div>
                <label className={labelCls}>Cor do verso</label>
                <select value={item.corVerso ? 'cor' : 'pb'} onChange={(e) => update({ corVerso: e.target.value === 'cor' })} className={inputCls}>
                  <option value="cor">A cores</option>
                  <option value="pb">Preto e branco (P&B)</option>
                </select>
              </div>
            )}
            {(fly.acabamentos || []).length > 0 && (
              <div>
                <label className={labelCls}>Acabamentos</label>
                <div className="space-y-2">
                  {(fly.acabamentos || []).map((a: any) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.flyerAcabamentos.includes(a.id)} onChange={() => toggleFlyerAcab(a.id)} className="h-4 w-4 accent-emerald-600" />
                      {a.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {isVinil && (
          <>
            {/* 1. Dados do trabalho */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">1. Dados do trabalho</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Largura (mm)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.larguraMm}
                    onChange={(e) => update({ larguraMm: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Altura (mm)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.alturaMm}
                    onChange={(e) => update({ alturaMm: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* 2. Substrato e Impressão */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">2. Substrato e Impressão</p>
              <div>
                <label className={labelCls}>Substrato</label>
                <select value={item.vinilSubstratoId} onChange={(e) => update({ vinilSubstratoId: e.target.value })} className={inputCls}>
                  {(vin.substratos || [])
                    .filter((s: any) => s.ativo !== false || s.id === item.vinilSubstratoId)
                    .map((s: any) => (
                    <option key={s.id} value={s.id}>{s.id} · {s.descricao} ({s.aplicacao})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cores</label>
                  <input type="text" value="CMYK (4 cores)" disabled className={inputCls + ' opacity-70 cursor-not-allowed'} />
                </div>
                <div>
                  <label className={labelCls}>Aplicação</label>
                  <select value={item.vinilAplicacao} onChange={(e) => update({ vinilAplicacao: e.target.value })} className={inputCls}>
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Laminação</label>
                <select value={item.vinilLaminacaoId} onChange={(e) => update({ vinilLaminacaoId: e.target.value })} className={inputCls}>
                  <option value="">Nenhuma</option>
                  {laminacoesVinil(vin).map((l: any) => (
                    <option key={l.id} value={l.id}>{l.nome} — {l.precoM2} €/m²</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Recorte de contorno */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">3. Recorte de contorno</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!item.vinilRecorteContorno} onChange={(e) => update({ vinilRecorteContorno: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  Recorte de contorno
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!item.vinilPelicula} onChange={(e) => update({ vinilPelicula: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  Película de transporte
                </label>
              </div>
            </div>

            {/* 4. Acabamento */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">4. Acabamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!item.vinilIlhoses} onChange={(e) => update({ vinilIlhoses: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  Ilhoses (a cada 30 cm)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!item.vinilBiadesivo} onChange={(e) => update({ vinilBiadesivo: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  Biadesivo (por metro linear)
                </label>
              </div>
            </div>

            {/* 5. Aplicação no local */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">5. Aplicação no local</p>
              <div>
                <label className={labelCls}>Aplicação no local?</label>
                <select value={item.vinilAplicacaoNoLocal ? 'sim' : 'nao'} onChange={(e) => update({ vinilAplicacaoNoLocal: e.target.value === 'sim' })} className={inputCls}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              {item.vinilAplicacaoNoLocal && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Distância (km)</label>
                    <input type="number" min={0} value={item.vinilAplicKm} onChange={(e) => update({ vinilAplicKm: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Funcionários</label>
                    <input type="number" min={0} value={item.vinilAplicFunc} onChange={(e) => update({ vinilAplicFunc: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Horas</label>
                    <input type="number" min={0} step="0.05" value={item.vinilAplicHoras} onChange={(e) => update({ vinilAplicHoras: e.target.value })} className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>Margem comercial (%) — vazio = automática por quantidade</label>
                <input type="number" min={0} value={item.vinilMargemOverride} onChange={(e) => update({ vinilMargemOverride: e.target.value })} placeholder="auto" className={inputCls} />
              </div>
            </div>

            {/* Aproveitamento do rolo (informativo — não altera o preço) */}
            {calc?.aproveitamentoRolo && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Aproveitamento do rolo</p>
                {calc.aproveitamentoRolo.placa ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Base de facturação</span><span className="font-medium text-right">{calc.aproveitamentoRolo.baseFaturacao}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Área da peça</span><span className="font-medium text-right">{calc.aproveitamentoRolo.areaPecasM2.toFixed(2)} m²</span></div>
                    <div className="flex justify-between gap-3 border-t border-border/60 pt-1 mt-1"><span className="text-muted-foreground">Preço efetivo</span><span className="font-semibold text-emerald-700 text-right">{formatCurrency(calc.aproveitamentoRolo.precoPorM2)}/m²</span></div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Base de facturação</span><span className="font-medium text-right">{calc.aproveitamentoRolo.baseFaturacao}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Largura do rolo</span><span className="font-medium text-right">{calc.aproveitamentoRolo.larguraRoloMm} mm</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Orientação · peças/largura</span><span className="font-medium text-right">{calc.aproveitamentoRolo.orientacao} · {calc.aproveitamentoRolo.pecasPorLargura}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Rolo consumido</span><span className="font-medium text-right">{calc.aproveitamentoRolo.compRoloM.toFixed(2)} m ({calc.aproveitamentoRolo.areaRoloM2.toFixed(2)} m²)</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Área real das peças</span><span className="font-medium text-right">{calc.aproveitamentoRolo.areaPecasM2.toFixed(2)} m²</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Aproveitamento</span><span className={'font-semibold text-right ' + (calc.aproveitamentoRolo.aproveitamentoPct >= 0.8 ? 'text-emerald-700' : calc.aproveitamentoRolo.aproveitamentoPct >= 0.6 ? 'text-amber-600' : 'text-red-600')}>{Math.round(calc.aproveitamentoRolo.aproveitamentoPct * 100)}%</span></div>
                    <div className="flex justify-between gap-3 border-t border-border/60 pt-1 mt-1"><span className="text-muted-foreground">Preço efetivo</span><span className="font-semibold text-emerald-700 text-right">{formatCurrency(calc.aproveitamentoRolo.precoPorM2)}/m² · {formatCurrency(calc.aproveitamentoRolo.precoPorMetroLinear)}/m linear</span></div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {calc.aproveitamentoRolo.placa
                    ? 'Placa rígida: o preço é faturado pela área real da peça.'
                    : 'O preço é faturado pelo comprimento de rolo consumido (metro linear), tal como no Excel. O €/m² é indicativo, sobre a área real da peça.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ACABAMENTOS */}
      {!isContratar && !isFlyer && !isVinil && !isLivre && !isArtigo && (
        <div className="pt-1 border-t border-border/50 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acabamentos</p>
          {!isSticker && (
            <>
              <div>
                <label className={labelCls}>Tipo de corte</label>
                <select value={item.tipoCorte} onChange={(e) => update({ tipoCorte: e.target.value })} className={inputCls}>
                  <option value="nenhum">Sem corte</option>
                  {cortesDisponiveis.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.vinco} onChange={(e) => update({ vinco: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                Vinco
              </label>
              <div>
                <label className={labelCls}>Laminações</label>
                <div className="space-y-2">
                  {config.laminacoes.map((l: any) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.laminacoes.includes(l.id)} onChange={() => toggleLam(l.id)} className="h-4 w-4 accent-emerald-600" />
                      {l.nome}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {isSticker && (
            <>
              <div>
                <label className={labelCls}>Tipo de corte</label>
                <select value={item.stickerCorte} onChange={(e) => update({ stickerCorte: e.target.value })} className={inputCls}>
                  {stickerCortes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Laminação</label>
                <select value={item.stickerLaminacaoId} onChange={(e) => update({ stickerLaminacaoId: e.target.value })} className={inputCls}>
                  <option value="">Nenhuma</option>
                  {(stk.laminacoes || []).map((l: any) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* ARTE-FINAL (por produto) */}
      {!isLivre && !isArtigo && (
      <div className="pt-1 border-t border-border/50 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Arte-final (ficheiro de design)</p>
        <div>
          <label className={labelCls}>Quem faz o ficheiro?</label>
          <select value={item.arteFinalModo} onChange={(e) => setArteModo(e.target.value)} className={inputCls}>
            {ARTE_FINAL_OPCOES.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ARTE_FINAL_OPCOES.find((o) => o.id === item.arteFinalModo)?.descricao}
          </p>
        </div>
        {item.arteFinalModo !== 'cliente' && (
          <div>
            <label className={labelCls}>Valor da arte-final (€) — somado ao orçamento</label>
            <input type="number" step="0.01" min={0} value={item.arteFinalValor} onChange={(e) => update({ arteFinalValor: e.target.value })} placeholder="—" className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1">Sugerido: {formatCurrency(arteFinalValorSugerido(item.arteFinalModo, config))}. Pode ajustar. (Os valores predefinidos alteram-se na Configuração.)</p>
          </div>
        )}
        {item.arteFinalModo === 'cliente' && (
          <div>
            <label className={labelCls}>Ficheiro do cliente (opcional)</label>
            {item.arteFinalFicheiro ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <FileCheck2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{item.arteFinalNome || 'Ficheiro anexado'}</span>
                <button type="button" onClick={() => update({ arteFinalFicheiro: '', arteFinalNome: '' })} className="p-1 rounded hover:bg-emerald-100" title="Remover ficheiro">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input bg-background hover:bg-muted text-sm font-medium cursor-pointer">
                {uploadingArte ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Anexar ficheiro do cliente
                <input type="file" className="hidden" disabled={uploadingArte} onChange={(e) => { uploadArteFicheiro(e.target.files?.[0]); e.currentTarget.value = ''; }} />
              </label>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Sem custo de design. Anexe aqui a arte que o cliente enviou (guardada em segurança).</p>
          </div>
        )}
      </div>
      )}

      {/* SUBTOTAL do produto */}
      <div className="pt-3 border-t border-border flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Subtotal do produto {calcLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-700">
            {calc ? formatCurrency(calc.precoSemIva) : '—'}
          </div>
          {isVinil && calc && calc.cartoesPorFolha > 0 && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {formatCurrency(calc.precoSemIva / calc.cartoesPorFolha)}/m² · {Number(calc.cartoesPorFolha).toFixed(2)} m²
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
