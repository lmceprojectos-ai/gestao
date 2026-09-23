import {
  GraficaConfig,
  CustosDerivados,
  StickersInput,
  StickersConfig,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';
import { configGraficaDefault } from '../config-default';
import {
  margemParaQuantidade,
  overheadPct,
  precoExcel,
  custoOperacaoExcel,
  tintaMutohM2,
} from '../derived';

// Garante que temos uma configuração de stickers (fallback para a predefinida)
function getStickersConfig(config: GraficaConfig): StickersConfig {
  return config.stickers || (configGraficaDefault.stickers as StickersConfig);
}

// Preço €/cm² de um substrato (Excel 'Dados Base' col. I): preço ÷ (folhas × largura cm × comprimento cm)
function precoSubstratoCm2(s: StickersConfig['substratos'][number]): number {
  const areaCm2 = (s.larguraMm / 10) * (s.comprimentoMm / 10);
  const folhas = s.folhasCaixa > 0 ? s.folhasCaixa : 1;
  return areaCm2 > 0 && s.precoRolo > 0 ? s.precoRolo / (areaCm2 * folhas) : 0;
}

// Folhas/hora (Excel) por tipo de corte — fallback quando a config ainda não tem `folhasHora`
const CORTE_STICKER_FOLHAS_HORA: Record<string, number> = {
  Nenhum: 0,
  'Corte reto (guilhotina)': 500,
  'Corte e vinco': 130,
  'Cantos redondos': 180,
  'Recorte personalizado': 150,
};

export function folhasHoraCorteSticker(cfg: StickersConfig, tipoCorte: string): number {
  const c = cfg.cortes.find((x) => x.id === tipoCorte || x.nome === tipoCorte);
  if (c && c.folhasHora != null) return c.folhasHora;
  if (tipoCorte in CORTE_STICKER_FOLHAS_HORA) return CORTE_STICKER_FOLHAS_HORA[tipoCorte];
  // ids antigos (velocidades mm/s) → equivalente Excel: recorte personalizado
  return CORTE_STICKER_FOLHAS_HORA['Recorte personalizado'];
}

interface LinhaStickers {
  tipo: 'Rolo' | 'Folha';
  areaTotalCm2: number;
  folhas: number; // Folha: folhas de impressão; Rolo: passagens de corte
  perFolha: number;
  folhasInfo: string;
  substrato: number;
  impressao: number;
  laminacao: number;
  corte: number;
  custoDireto: number;
  overhead: number;
  custoTotal: number;
  margem: number;
  precoSemIva: number;
}

// Modelo Excel (Calculadora Stickers)
function calcularLinha(
  input: StickersInput,
  quantidade: number,
  config: GraficaConfig,
  cfg: StickersConfig
): LinhaStickers {
  const substrato = cfg.substratos.find((s) => s.id === input.substratoId);
  // Via de produção determinada pelo substrato (Excel: "Tipo de substrato (automático)")
  const tipo: 'Rolo' | 'Folha' = substrato?.maquina === 'Xerox' ? 'Folha' : 'Rolo';

  // Áreas (Excel trabalha em cm, sem sangria)
  const areaUnitCm2 = (input.larguraMm / 10) * (input.alturaMm / 10);
  const areaTotalCm2 = areaUnitCm2 * quantidade;
  const areaTotalM2 = areaTotalCm2 / 10000;

  // Substrato = área total × €/cm²
  const precoCm2 = substrato ? precoSubstratoCm2(substrato) : 0;
  const custoSubstrato = areaTotalCm2 * precoCm2;

  // Folhas (Folha) / passagens de corte (Rolo)
  const areaFolhaCm2 = substrato ? (substrato.larguraMm / 10) * (substrato.comprimentoMm / 10) : 0;
  const areaPassagem = cfg.areaPassagemCm2 && cfg.areaPassagemCm2 > 0 ? cfg.areaPassagemCm2 : 7000;
  let folhas = 0;
  let perFolha = 0;
  let folhasInfo = '—';
  if (quantidade > 0) {
    if (tipo === 'Folha') {
      folhas = areaFolhaCm2 > 0 ? Math.ceil(areaTotalCm2 / areaFolhaCm2) : 0;
      perFolha = areaUnitCm2 > 0 ? Math.floor(areaFolhaCm2 / areaUnitCm2) : 0;
      folhasInfo = substrato
        ? `${folhas} folha${folhas === 1 ? '' : 's'} (${substrato.larguraMm} × ${substrato.comprimentoMm} mm)`
        : '—';
    } else {
      folhas = Math.ceil(areaTotalCm2 / areaPassagem);
      perFolha = areaUnitCm2 > 0 ? Math.floor(areaPassagem / areaUnitCm2) : 0;
      folhasInfo = `Rolo: ${areaTotalM2.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² · ${folhas} passagem${folhas === 1 ? '' : 'ns'} de corte`;
    }
  }

  // Impressão: Folha = folhas × clique (Cores/P&B); Rolo = m² × tinta Mutoh €/m²
  const impressao =
    tipo === 'Folha'
      ? folhas * (input.cor ? config.cliqueCor : config.cliquePB)
      : areaTotalM2 * tintaMutohM2(config);

  // Laminação = área total × €/cm². Opção escolhida (Mate/Brilho) ou legado (booleano).
  const lamSel = input.laminacaoId
    ? (cfg.laminacoes || []).find((l) => l.id === input.laminacaoId)
    : undefined;
  const lamPrecoM2 = lamSel ? lamSel.precoM2 : cfg.laminacaoMutohM2;
  const temLaminacao = input.laminacaoId ? !!lamSel : input.laminacao;
  const laminacao = temLaminacao ? areaTotalCm2 * (lamPrecoM2 / 10000) : 0;

  // Corte = (folhas | passagens) × (custo hora ÷ folhas/hora) + setup
  const fh = folhasHoraCorteSticker(cfg, input.tipoCorte);
  const corte = fh > 0 ? custoOperacaoExcel(config, fh, folhas) : 0;

  const custoDireto = custoSubstrato + impressao + laminacao + corte;
  const margem = margemParaQuantidade(config, quantidade);
  const { overhead, custoTotal, precoSemIva } = precoExcel(custoDireto, overheadPct(config), margem);

  return {
    tipo,
    areaTotalCm2,
    folhas,
    perFolha,
    folhasInfo,
    substrato: custoSubstrato,
    impressao,
    laminacao,
    corte,
    custoDireto,
    overhead,
    custoTotal,
    margem,
    precoSemIva,
  };
}

export const stickersCalculator: ProdutoCalculator = {
  id: 'stickers',
  label: 'Stickers / Adesivos',
  calcular(input: StickersInput, quantidade, config, _derivados: CustosDerivados, opcoes): ResultadoOrcamento {
    const cfg = getStickersConfig(config);

    // Descontos / sobretaxas (igual aos cartões)
    const descCfg = config.descontosCliente.find((d) => d.tipo === opcoes.tipoCliente);
    const descontoCliente =
      opcoes.descontoManual != null && !isNaN(opcoes.descontoManual)
        ? opcoes.descontoManual
        : descCfg
        ? descCfg.desconto
        : 0;
    const sobretaxa = opcoes.entrega24h ? config.sobretaxa24h : 0;
    const ivaRate = opcoes.ivaZero ? 0 : config.iva;

    const base = calcularLinha(input, quantidade, config, cfg);
    const precoSemIva = base.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = quantidade > 0 ? precoSemIva / quantidade : 0;
    const margemEfetiva = precoSemIva > 0 ? (precoSemIva - base.custoTotal) / precoSemIva : 0;

    // Aproveitamento: área dos stickers / área de material consumida
    const areaMaterial =
      base.tipo === 'Folha'
        ? base.folhas *
          ((cfg.substratos.find((s) => s.id === input.substratoId)?.larguraMm || 0) / 10) *
          ((cfg.substratos.find((s) => s.id === input.substratoId)?.comprimentoMm || 0) / 10)
        : base.areaTotalCm2;
    const aproveitamento = areaMaterial > 0 ? base.areaTotalCm2 / areaMaterial : 0;

    const label = base.tipo === 'Rolo' ? 'Mutoh (rolo)' : 'Versant (folha)';

    const componentes: ComponenteCusto[] = [
      { chave: 'substrato', label: 'Substrato / papel', valor: base.substrato },
      { chave: 'tinta', label: base.tipo === 'Rolo' ? 'Tinta (Mutoh)' : 'Impressão (cliques)', valor: base.impressao },
      { chave: 'laminacao', label: 'Laminação', valor: base.laminacao },
      { chave: 'corte', label: 'Acabamento / corte', valor: base.corte },
      { chave: 'setup', label: 'Custos indiretos (15%)', valor: base.overhead },
    ].filter((c) => c.valor > 0 || ['substrato', 'tinta', 'setup'].includes(c.chave));

    // Tabela por quantidade
    const tabela: LinhaTabelaPreco[] = config.quantidadesTabela.map((q) => {
      const b = calcularLinha(input, q, config, cfg);
      const ps = b.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
      return {
        quantidade: q,
        folhas: b.folhas,
        custoPapel: b.substrato,
        custoImpressao: b.impressao,
        custoPreImp: b.overhead,
        custoCorte: b.corte,
        custoVinco: 0,
        custoLaminacoes: b.laminacao,
        custoTotal: b.custoTotal,
        margem: b.margem,
        precoSemIva: ps,
        precoComIva: ps * (1 + ivaRate),
        precoUnitario: q > 0 ? ps / q : 0,
      };
    });

    return {
      produto: 'stickers',
      quantidade,
      cartoesPorFolha: base.perFolha,
      aproveitamento,
      orientacao: label,
      opcaoProducao: label,
      folhasInfo: base.folhasInfo,
      folhas: base.folhas,
      componentes,
      custoTotal: base.custoTotal,
      margem: base.margem,
      descontoCliente,
      sobretaxa24h: sobretaxa,
      precoSemIva,
      precoComIva,
      precoUnitario,
      abaixoMargemMinima: margemEfetiva < config.margemMinima,
      tabela,
    };
  },
};
