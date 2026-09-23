import { GraficaConfig, CustosDerivados } from './types';

// Calcula os valores derivados a partir da configuração base.
// Reproduz a cascata de fórmulas da folha de cálculo original.
export function calcularDerivados(config: GraficaConfig): CustosDerivados {
  const { custosFixos, equipamentos } = config;

  // Amortização mensal total (Σ investimento/amortMeses)
  const amortMensalTotal = equipamentos.reduce(
    (acc, e) => acc + (e.amortMeses > 0 ? e.investimento / e.amortMeses : 0),
    0
  );

  // Custo fixo total mensal
  const custoFixoMes =
    custosFixos.operadorMes +
    custosFixos.rendaMes +
    custosFixos.softwareAno / 12 +
    custosFixos.segurosAno / 12 +
    amortMensalTotal;

  // Horas úteis por mês (calendário) e horas realmente produtivas (ocupação)
  const horasUteisMes = custosFixos.diasUteisMes * custosFixos.horasDia;
  const taxaOcupacao =
    custosFixos.taxaOcupacao != null && custosFixos.taxaOcupacao > 0
      ? custosFixos.taxaOcupacao
      : 1;
  const horasProdutivasMes = horasUteisMes * taxaOcupacao;

  // Os custos fixos distribuem-se pelas horas produtivas (não pelas de calendário).
  // Com taxa = 1 o resultado é idêntico ao anterior.
  const custoFixoHora = horasProdutivasMes > 0 ? custoFixoMes / horasProdutivasMes : 0;
  const custoFixoMinuto = custoFixoHora / 60;

  // Custo €/hora de cada equipamento (amort/mês / (horasUsoDia * diasUteisMes * horasDia... )
  // Na folha original: I = (amort/mês) / (horasUsoDia * diasUteisMes * horasDia)
  const equipamentoHora: Record<string, number> = {};
  for (const e of equipamentos) {
    const amortMes = e.amortMeses > 0 ? e.investimento / e.amortMeses : 0;
    const denom = e.horasUsoDia * custosFixos.diasUteisMes * custosFixos.horasDia;
    equipamentoHora[e.nome] = denom > 0 ? amortMes / denom : 0;
  }

  // Corte/Vinco: €/folha = (custoFixoHora + equipamentoHora) / velocidade ; setup = setupMin * custoFixoMinuto
  const corteFolha: Record<string, number> = {};
  const corteSetup: Record<string, number> = {};
  for (const c of config.cortes) {
    const eqHora = equipamentoHora[c.equipamento] || 0;
    corteFolha[c.id] = c.velocidade > 0 ? (custoFixoHora + eqHora) / c.velocidade : 0;
    corteSetup[c.id] = c.setupMin * custoFixoMinuto;
  }

  return {
    amortMensalTotal,
    custoFixoMes,
    horasUteisMes,
    horasProdutivasMes,
    custoFixoHora,
    custoFixoMinuto,
    equipamentoHora,
    corteFolha,
    corteSetup,
  };
}

// Custo por folha de um papel (modelo Excel: custo resma ÷ folhas, sem margem de fornecedor)
export function custoFolhaPapel(config: GraficaConfig, papelId: string): number {
  const p = config.papeis.find((x) => x.id === papelId);
  if (!p) return 0;
  return p.folhasResma > 0 ? p.custoBase / p.folhasResma : 0;
}

// ---- Parâmetros do modelo Excel (CRIAORCAMENTOS v3) com predefinições ----
export const EXCEL_DEFAULTS = {
  overheadPct: 0.15,
  custoHoraMaquina: 31.75,
  setupCorteEur: 5,
  tintaMutohM2: 1.4,
};

export function overheadPct(config: GraficaConfig): number {
  return config.overheadPct ?? EXCEL_DEFAULTS.overheadPct;
}
export function custoHoraMaquina(config: GraficaConfig): number {
  return config.custoHoraMaquina ?? EXCEL_DEFAULTS.custoHoraMaquina;
}
export function setupCorteEur(config: GraficaConfig): number {
  return config.setupCorteEur ?? EXCEL_DEFAULTS.setupCorteEur;
}
export function tintaMutohM2(config: GraficaConfig): number {
  return config.tintaMutohM2 ?? EXCEL_DEFAULTS.tintaMutohM2;
}

// Custo de uma operação de corte/vinco/dobra (Excel): unidades × (custoHora ÷ folhasHora) + setup
export function custoOperacaoExcel(config: GraficaConfig, folhasHora: number, unidades: number): number {
  if (!folhasHora || folhasHora <= 0 || unidades <= 0) return 0;
  return unidades * (custoHoraMaquina(config) / folhasHora) + setupCorteEur(config);
}

// Folhas/hora de um corte da tabela `cortes` (fallback para os valores do Excel por id)
const CORTE_FOLHAS_HORA_FALLBACK: Record<string, number> = {
  guilhotina: 500,
  cantos: 180,
  contorno: 150,
  vinco: 130,
};
function fallbackCorte(texto: string): number {
  const t = (texto || '').toLowerCase();
  if (t.includes('guilh')) return CORTE_FOLHAS_HORA_FALLBACK.guilhotina;
  if (t.includes('canto')) return CORTE_FOLHAS_HORA_FALLBACK.cantos;
  if (t.includes('contorno')) return CORTE_FOLHAS_HORA_FALLBACK.contorno;
  if (t.includes('vinco') || t === 'c/v') return CORTE_FOLHAS_HORA_FALLBACK.vinco;
  return CORTE_FOLHAS_HORA_FALLBACK[t] ?? 0;
}
export function folhasHoraCorte(config: GraficaConfig, corteId: string): number {
  const c = config.cortes.find((x) => x.id === corteId);
  if (c?.folhasHora && c.folhasHora > 0) return c.folhasHora;
  return fallbackCorte(c ? `${c.id} ${c.nome}` : corteId);
}

// Preço s/IVA a partir do custo direto: overhead + margem sobre o preço (Excel: custo×(1+ov)/(1−margem))
export function precoExcel(custoDireto: number, ov: number, margem: number): {
  overhead: number;
  custoTotal: number;
  precoSemIva: number;
} {
  const overhead = custoDireto * ov;
  const custoTotal = custoDireto + overhead;
  const precoSemIva = margem < 1 ? custoTotal / (1 - margem) : custoTotal;
  return { overhead, custoTotal, precoSemIva };
}

// Margem para uma quantidade (match-mode: maior faixa <= quantidade)
export function margemParaQuantidade(config: GraficaConfig, quantidade: number): number {
  const ordenadas = [...config.faixasMargem].sort((a, b) => a.quantidade - b.quantidade);
  let margem = ordenadas.length ? ordenadas[0].margem : 0;
  for (const f of ordenadas) {
    if (quantidade >= f.quantidade) margem = f.margem;
  }
  return margem;
}
