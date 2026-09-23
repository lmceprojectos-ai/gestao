import {
  GraficaConfig,
  CustosDerivados,
  VinilInput,
  VinilConfig,
  VinilSubstratoConfig,
  VinilLaminacaoConfig,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  AproveitamentoRolo,
  ProdutoCalculator,
} from '../types';
import { configGraficaDefault } from '../config-default';
import { margemParaQuantidade, overheadPct, precoExcel, tintaMutohM2 } from '../derived';

// Modelo de custeio = folha "Calculadora Gde Formato" do Excel CRIAORCAMENTOS v3.

// Laminações predefinidas (Excel 'Dados Base') — usadas se a config não as tiver
export const VINIL_LAMINACOES_DEFAULT: VinilLaminacaoConfig[] = [
  { id: 'LP2812G-1050', nome: 'Laminação LP2812G brilho 1050mm', larguraMm: 1050, precoM2: 1.5 },
  { id: 'LP2812G-1370', nome: 'Laminação LP2812G brilho 1370mm', larguraMm: 1370, precoM2: 1.5 },
  { id: 'LP2812M-1060', nome: 'Laminação LP2812M mate 1060mm', larguraMm: 1060, precoM2: 1.4858 },
];

// Garante uma configuração de vinil (fallback para a predefinida)
function getVinilConfig(config: GraficaConfig): VinilConfig {
  return config.vinil || (configGraficaDefault.vinil as VinilConfig);
}

export function laminacoesVinil(cfg: VinilConfig): VinilLaminacaoConfig[] {
  return cfg.laminacoes && cfg.laminacoes.length ? cfg.laminacoes : VINIL_LAMINACOES_DEFAULT;
}

export function isPlacaRigida(sub: VinilSubstratoConfig | undefined): boolean {
  return (sub?.aplicacao || '').toLowerCase().includes('placa');
}

type TipoProducao = 'Impressão' | 'Recorte' | 'Impressão+Recorte';

// Tipo de produção a partir da aplicação do substrato + flags
function tipoProducao(sub: VinilSubstratoConfig | undefined, input: VinilInput): TipoProducao {
  const ap = (sub?.aplicacao || '').toLowerCase();
  const soCorte = ap.includes('corte') && !ap.includes('impress');
  const recorte = !!input.recorteContorno || soCorte;
  if (soCorte && !input.imprimir) return 'Recorte';
  return recorte ? 'Impressão+Recorte' : 'Impressão';
}

// Melhor aproveitamento do rolo — Excel: testa as duas orientações e escolhe a que
// consome menos comprimento de rolo. Devolve comprimento, peças por largura e orientação.
interface DetalheAproveitamento {
  comp: number; // metros de rolo consumidos (melhor orientação)
  pecasPorLargura: number; // peças ao longo da largura (melhor orientação)
  orientacao: string; // 'Direita' | 'Rodada' | '—'
}

function aproveitamentoRoloDetalhe(
  largRoloMm: number,
  largMm: number,
  altMm: number,
  qtd: number
): DetalheAproveitamento {
  if (largRoloMm <= 0 || largMm <= 0 || altMm <= 0 || qtd <= 0) {
    return { comp: 0, pecasPorLargura: 0, orientacao: '—' };
  }
  const pecasA = Math.floor(largRoloMm / largMm); // peça direita (largura ao longo do rolo)
  const pecasB = Math.floor(largRoloMm / altMm); // peça rodada (altura ao longo do rolo)
  const compA = pecasA > 0 ? (Math.ceil(qtd / pecasA) * altMm) / 1000 : Infinity;
  const compB = pecasB > 0 ? (Math.ceil(qtd / pecasB) * largMm) / 1000 : Infinity;
  if (!isFinite(compA) && !isFinite(compB)) {
    return { comp: 0, pecasPorLargura: 0, orientacao: '—' };
  }
  if (compA <= compB) {
    return { comp: compA, pecasPorLargura: pecasA, orientacao: 'Direita' };
  }
  return { comp: compB, pecasPorLargura: pecasB, orientacao: 'Rodada' };
}

// Comprimento de rolo (m) necessário — Excel: melhor orientação (peças por largura)
function comprimentoRolo(largRoloMm: number, largMm: number, altMm: number, qtd: number): number {
  return aproveitamentoRoloDetalhe(largRoloMm, largMm, altMm, qtd).comp;
}

interface CustoLinha {
  areaTotal: number; // m²
  compRolo: number; // m
  custoSubstrato: number;
  custoSuporte: number;
  custoTinta: number;
  custoLaminacao: number;
  custoRecorte: number;
  custoAplicSubstrato: number;
  custoIlhoses: number;
  custoBiadesivo: number;
  custoDireto: number;
  overhead: number;
  custoTotal: number; // direto + overhead (sem aplicação local)
  margem: number;
  precoMaterial: number; // preço s/IVA do material (antes de desconto/urgência)
  custoAplicacao: number;
  precoAplicacao: number;
}

function calcularLinha(
  input: VinilInput,
  quantidade: number,
  sub: VinilSubstratoConfig | undefined,
  cfg: VinilConfig,
  config: GraficaConfig
): CustoLinha {
  const largMm = input.larguraMm || 0;
  const altMm = input.alturaMm || 0;
  const areaUnit = (largMm * altMm) / 1_000_000; // sem sangria (Excel)
  const areaTotal = areaUnit * quantidade;
  const tipo = tipoProducao(sub, input);

  // Substrato
  const placa = isPlacaRigida(sub);
  const largRolo = sub ? sub.larguraMm : 0;
  const compRolo = placa ? 0 : comprimentoRolo(largRolo, largMm, altMm, quantidade);
  const custoSubstrato = sub
    ? placa
      ? areaTotal * sub.precoM2
      : compRolo * (largRolo / 1000) * sub.precoM2
    : 0;

  // Suporte rígido adicional
  const suporte = input.suporteRigidoId ? cfg.substratos.find((s) => s.id === input.suporteRigidoId) : undefined;
  const custoSuporte = suporte ? areaTotal * suporte.precoM2 : 0;

  // Tinta (não em recorte puro)
  const nCores = input.nCores != null && input.nCores > 0 ? Math.min(4, input.nCores) : 4;
  const custoTinta = tipo === 'Recorte' ? 0 : areaTotal * (nCores / 4) * tintaMutohM2(config);

  // Laminação — Excel F22: mesmo comprimento e largura do rolo de substrato × €/m² da laminação
  const lam = input.laminacaoId ? laminacoesVinil(cfg).find((l) => l.id === input.laminacaoId) : undefined;
  const custoLaminacao = lam && !placa ? compRolo * (largRolo / 1000) * lam.precoM2 : 0;

  // Recorte de contorno (Graphtec): recorte + descasque (+ aplicação de película)
  const temRecorte = tipo !== 'Impressão';
  const custoRecorte = temRecorte
    ? areaTotal * (cfg.recorteCustoM2 + cfg.recorteDescasqueM2 + (input.pelicula ? cfg.recorteAplicPeliculaM2 : 0))
    : 0;

  // Aplicação no substrato/suporte
  const aplicSub = !!input.aplicacaoSubstrato || !!suporte;
  const custoAplicSubstrato = aplicSub ? areaTotal * (cfg.aplicacaoSubstratoM2 ?? 5) : 0;

  // Consumíveis — ilhoses e biadesivo calculados pelo perímetro da peça
  const perimetroMm = 2 * (largMm + altMm);
  const ilhosPasso = cfg.ilhosPassoMm ?? 300;
  const nIlh = input.ilhoses
    ? Math.ceil(perimetroMm / ilhosPasso) * quantidade
    : (input.nIlhoses || 0);
  const custoIlhoses = nIlh * (cfg.ilhosCustoUn ?? 0.25);
  const metrosBia = input.biadesivo
    ? (perimetroMm / 1000) * quantidade
    : (input.metrosBiadesivo || 0);
  const custoBiadesivo = metrosBia * (cfg.biadesivoMetro ?? 1.5);

  const custoDireto =
    custoSubstrato + custoSuporte + custoTinta + custoLaminacao + custoRecorte + custoAplicSubstrato + custoIlhoses + custoBiadesivo;

  const margem =
    input.margemOverride != null && !isNaN(input.margemOverride)
      ? input.margemOverride
      : margemParaQuantidade(config, quantidade);
  const p = precoExcel(custoDireto, overheadPct(config), margem);

  // Aplicação no local (deslocação + mão de obra) — margem própria, sem desconto/urgência
  let custoAplicacao = 0;
  let precoAplicacao = 0;
  if (input.aplicacaoNoLocal) {
    const km = input.aplicKm ?? cfg.aplicDistanciaKm;
    const func = input.aplicFuncionarios ?? cfg.aplicNumFuncionarios;
    const horas = input.aplicHoras ?? cfg.aplicTempoHoras;
    custoAplicacao = km * cfg.aplicCustoKm + func * horas * cfg.aplicCustoMaoObraHora;
    precoAplicacao = cfg.aplicMargem < 1 ? custoAplicacao / (1 - cfg.aplicMargem) : custoAplicacao;
  }

  return {
    areaTotal,
    compRolo,
    custoSubstrato,
    custoSuporte,
    custoTinta,
    custoLaminacao,
    custoRecorte,
    custoAplicSubstrato,
    custoIlhoses,
    custoBiadesivo,
    custoDireto,
    overhead: p.overhead,
    custoTotal: p.custoTotal,
    margem,
    precoMaterial: p.precoSemIva,
    custoAplicacao,
    precoAplicacao,
  };
}

export const vinilCalculator: ProdutoCalculator = {
  id: 'vinil',
  label: 'Impressão digital de grande formato',
  calcular(input: VinilInput, quantidade, config, _derivados: CustosDerivados, opcoes): ResultadoOrcamento {
    const cfg = getVinilConfig(config);
    const sub = cfg.substratos.find((s) => s.id === input.substratoId);

    const descCfg = config.descontosCliente.find((d) => d.tipo === opcoes.tipoCliente);
    const descontoCliente =
      opcoes.descontoManual != null && !isNaN(opcoes.descontoManual)
        ? opcoes.descontoManual
        : descCfg
        ? descCfg.desconto
        : 0;
    const sobretaxa = opcoes.entrega24h ? config.sobretaxa24h : 0;
    const ivaRate = opcoes.ivaZero ? 0 : config.iva;

    const precoFinal = (l: CustoLinha) => l.precoMaterial * (1 - descontoCliente) * (1 + sobretaxa) + l.precoAplicacao;

    const linha = calcularLinha(input, quantidade, sub, cfg, config);
    const precoSemIva = precoFinal(linha);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = quantidade > 0 ? precoSemIva / quantidade : 0;
    const custoTotal = linha.custoTotal + linha.custoAplicacao;
    const margemEfetiva = precoSemIva > 0 ? (precoSemIva - custoTotal) / precoSemIva : 0;

    const componentes: ComponenteCusto[] = [
      { chave: 'substrato', label: 'Substrato', valor: linha.custoSubstrato },
      { chave: 'suporte', label: 'Suporte rígido', valor: linha.custoSuporte },
      { chave: 'tinta', label: 'Tinta', valor: linha.custoTinta },
      { chave: 'laminacao', label: 'Laminação', valor: linha.custoLaminacao },
      { chave: 'recorte', label: 'Recorte de contorno', valor: linha.custoRecorte },
      { chave: 'aplicacaoSubstrato', label: 'Aplicação no substrato', valor: linha.custoAplicSubstrato },
      { chave: 'ilhoses', label: 'Ilhoses', valor: linha.custoIlhoses },
      { chave: 'biadesivo', label: 'Biadesivo', valor: linha.custoBiadesivo },
      { chave: 'setup', label: 'Custos indiretos (15%)', valor: linha.overhead },
      { chave: 'aplicacao', label: 'Aplicação no local', valor: linha.custoAplicacao },
    ].filter((c) => c.valor > 0 || ['substrato', 'tinta', 'setup'].includes(c.chave));

    const tabela: LinhaTabelaPreco[] = config.quantidadesTabela.map((q) => {
      const l = calcularLinha(input, q, sub, cfg, config);
      const ps = precoFinal(l);
      return {
        quantidade: q,
        folhas: 0,
        custoPapel: l.custoSubstrato + l.custoSuporte,
        custoImpressao: l.custoTinta,
        custoPreImp: l.overhead,
        custoCorte: l.custoRecorte + l.custoAplicSubstrato + l.custoIlhoses + l.custoBiadesivo,
        custoVinco: 0,
        custoLaminacoes: l.custoLaminacao,
        custoTotal: l.custoTotal + l.custoAplicacao,
        margem: l.margem,
        precoSemIva: ps,
        precoComIva: ps * (1 + ivaRate),
        precoUnitario: q > 0 ? ps / q : 0,
      };
    });

    const tipo = tipoProducao(sub, input);

    // Aproveitamento do rolo (apresentação — não altera o preço)
    const placa = isPlacaRigida(sub);
    const largRolo = sub ? sub.larguraMm : 0;
    const det = aproveitamentoRoloDetalhe(largRolo, input.larguraMm || 0, input.alturaMm || 0, quantidade);
    const areaRoloM2 = placa ? linha.areaTotal : linha.compRolo * (largRolo / 1000);
    const aproveitamentoRolo: AproveitamentoRolo = {
      placa,
      larguraRoloMm: largRolo,
      orientacao: placa ? '—' : det.orientacao,
      pecasPorLargura: placa ? 0 : det.pecasPorLargura,
      compRoloM: placa ? 0 : linha.compRolo,
      areaPecasM2: linha.areaTotal,
      areaRoloM2,
      aproveitamentoPct: areaRoloM2 > 0 ? linha.areaTotal / areaRoloM2 : 0,
      baseFaturacao: placa ? 'Área da peça (placa)' : 'Metro linear (rolo)',
      precoPorM2: linha.areaTotal > 0 ? precoSemIva / linha.areaTotal : 0,
      precoPorMetroLinear: !placa && linha.compRolo > 0 ? precoSemIva / linha.compRolo : 0,
    };

    return {
      produto: 'vinil',
      quantidade,
      cartoesPorFolha: Number(linha.areaTotal.toFixed(4)),
      aproveitamento: aproveitamentoRolo.aproveitamentoPct,
      orientacao: tipo,
      opcaoProducao: tipo,
      aproveitamentoRolo,
      folhasInfo: isPlacaRigida(sub)
        ? `${linha.areaTotal.toFixed(2)} m² · placa`
        : `${linha.areaTotal.toFixed(2)} m² · rolo ${linha.compRolo.toFixed(2)} m`,
      folhas: 0,
      componentes,
      custoTotal,
      margem: linha.margem,
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
