import {
  GraficaConfig,
  CustosDerivados,
  FlyersInput,
  FlyersConfig,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';
import { configGraficaDefault } from '../config-default';
import { margemParaQuantidade, overheadPct, precoExcel } from '../derived';

// Garante uma configuração de flyers (fallback para a predefinida)
function getFlyersConfig(config: GraficaConfig): FlyersConfig {
  return config.flyers || (configGraficaDefault.flyers as FlyersConfig);
}

// Dimensões do flyer a partir do formato escolhido
function dimensoesFlyer(input: FlyersInput): { w: number; h: number } {
  switch (input.formato) {
    case 'A4':
      return { w: 210, h: 297 };
    case 'A5':
      return { w: 148, h: 210 };
    case 'A6':
      return { w: 105, h: 148 };
    case 'DL':
      return { w: 99, h: 210 };
    default:
      return { w: input.larguraMm || 0, h: input.alturaMm || 0 };
  }
}

// Flyers por folha (imposição, melhor das duas orientações)
function calcularImposicao(
  input: FlyersInput,
  papel: FlyersConfig['papeis'][number] | undefined,
  config: GraficaConfig,
  cfg: FlyersConfig
): { porFolha: number; aproveitamento: number; orientacao: string } {
  if (!papel) return { porFolha: 0, aproveitamento: 0, orientacao: '—' };
  const { w, h } = dimensoesFlyer(input);
  if (w <= 0 || h <= 0) return { porFolha: 0, aproveitamento: 0, orientacao: '—' };

  const bleed = cfg.bleedMm || 0;
  const flyerW = w + 2 * bleed;
  const flyerH = h + 2 * bleed;
  const usableW = papel.larguraMm - config.deducaoLarguraMm;
  const usableH = papel.alturaMm - 2 * config.perdaAgarreMm;

  const optA = Math.floor(usableW / flyerW) * Math.floor(usableH / flyerH);
  const optB = Math.floor(usableW / flyerH) * Math.floor(usableH / flyerW);

  const porFolha = Math.max(optA, optB, 0);
  const orientacao = optA >= optB ? 'Portrait' : 'Landscape';

  const areaFlyers = porFolha * w * h;
  const areaFolha = papel.larguraMm * papel.alturaMm;
  const aproveitamento = areaFolha > 0 ? areaFlyers / areaFolha : 0;

  return { porFolha, aproveitamento, orientacao };
}

// Custo por folha do papel de flyers
function custoFolhaPapelFlyer(papel: FlyersConfig['papeis'][number] | undefined): number {
  if (!papel) return 0;
  return papel.folhasResma > 0 ? papel.custoResma / papel.folhasResma : 0;
}

// Custo de produção (sem margem) para uma quantidade — modelo Excel (Calculadora Flyers / Imp. Pers.)
function calcularLinha(
  input: FlyersInput,
  quantidade: number,
  porFolha: number,
  papel: FlyersConfig['papeis'][number] | undefined,
  config: GraficaConfig,
  cfg: FlyersConfig,
  derivados: CustosDerivados
) {
  const folhas = porFolha > 0 ? Math.ceil(quantidade / porFolha) : 0;
  const lados = input.frenteVerso ? 2 : 1;

  // Papel = folhas × custo resma ÷ folhas/resma
  const custoPapel = folhas * custoFolhaPapelFlyer(papel);

  // Impressão (cliques): frente + verso, cada lado com a sua cor
  const cliqueFrente = input.corFrente ? config.cliqueCor : config.cliquePB;
  const cliqueVerso = input.corVerso ? config.cliqueCor : config.cliquePB;
  const custoImpressao = folhas * cliqueFrente + (input.frenteVerso ? folhas * cliqueVerso : 0);

  // Corte / vinco / dobra — modelo do Excel (Calculadora Flyers)
  const op = cfg.operacoes || {
    corteCustoFolha: 0.0635,
    corteSetup: 5,
    vincoCustoUnidade: 0.0264583,
    vincoSetup: 5,
    dobraCustoUnidade: 0.0211667,
    dobraSetup: 5,
  };
  const tipoFlyer = input.tipoFlyer || 'monofolha';
  const isMonofolha = tipoFlyer === 'monofolha';
  const corteGuilhotina = input.corteGuilhotina !== false; // default: Sim
  const vincar = !!input.vincar;

  // Corte reto em guilhotina: por folha + setup (Excel F25)
  const custoCorte = corteGuilhotina && folhas > 0 ? folhas * op.corteCustoFolha + op.corteSetup : 0;
  // Vinco: só se não for monofolha E se vincar antes de dobrar (Excel F26) — por unidade
  const custoVinco = !isMonofolha && vincar ? quantidade * op.vincoCustoUnidade + op.vincoSetup : 0;
  // Dobra: só se não for monofolha (Díptico e Tríptico = 1 passagem no Excel) — por unidade
  const custoDobra = !isMonofolha ? quantidade * op.dobraCustoUnidade + op.dobraSetup : 0;

  // Acabamentos selecionados: laminação / furação (custoUn/setup no modelo Excel)
  let custoAcabamentosSel = 0;
  for (const acId of input.acabamentos || []) {
    const ac = cfg.acabamentos.find((a) => a.id === acId);
    if (!ac) continue;
    if (ac.modelo === 'porFolha') {
      custoAcabamentosSel += ac.setup + folhas * ac.custoUn;
    } else if (ac.modelo === 'porFolhaLado') {
      custoAcabamentosSel += ac.setup + folhas * ac.custoUn * lados;
    } else {
      // porUnidade
      custoAcabamentosSel += ac.setup + quantidade * ac.custoUn;
    }
  }

  // Total de acabamentos (corte + vinco + dobra + laminação/furação) — grupo "Corte/Acabamentos" do Excel
  const custoAcabamentos = custoCorte + custoVinco + custoDobra + custoAcabamentosSel;

  const custoDireto = custoPapel + custoImpressao + custoAcabamentos;
  const margem = margemParaQuantidade(config, quantidade);
  const { overhead, custoTotal, precoSemIva } = precoExcel(custoDireto, overheadPct(config), margem);

  return {
    folhas,
    custoPapel,
    custoImpressao,
    custoPreImp: overhead,
    custoAcabamentos,
    custoTotal,
    margem,
    precoSemIva,
  };
}

export const flyersCalculator: ProdutoCalculator = {
  id: 'imp_peq_formato',
  label: 'Flyers',
  calcular(input: FlyersInput, quantidade, config, derivados, opcoes): ResultadoOrcamento {
    const cfg = getFlyersConfig(config);
    const papel = cfg.papeis.find((p) => p.id === input.papelId);
    const { porFolha, aproveitamento, orientacao } = calcularImposicao(input, papel, config, cfg);

    // Descontos / sobretaxas (igual aos restantes produtos)
    const descCfg = config.descontosCliente.find((d) => d.tipo === opcoes.tipoCliente);
    const descontoCliente =
      opcoes.descontoManual != null && !isNaN(opcoes.descontoManual)
        ? opcoes.descontoManual
        : descCfg
        ? descCfg.desconto
        : 0;
    const sobretaxa = opcoes.entrega24h ? config.sobretaxa24h : 0;
    const ivaRate = opcoes.ivaZero ? 0 : config.iva;

    const linha = calcularLinha(input, quantidade, porFolha, papel, config, cfg, derivados);
    const margem = linha.margem;
    const precoSemIva = linha.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = quantidade > 0 ? precoSemIva / quantidade : 0;

    const margemEfetiva =
      precoSemIva > 0 ? (precoSemIva - linha.custoTotal) / precoSemIva : 0;

    const componentes: ComponenteCusto[] = [
      { chave: 'papel', label: 'Papel', valor: linha.custoPapel },
      { chave: 'impressao', label: 'Impressão (cliques)', valor: linha.custoImpressao },
      { chave: 'acabamentos', label: 'Acabamentos', valor: linha.custoAcabamentos },
      { chave: 'preimp', label: 'Custos indiretos (15%)', valor: linha.custoPreImp },
    ].filter((c) => c.valor > 0 || ['papel', 'impressao', 'preimp'].includes(c.chave));

    // Tabela por quantidade
    const tabela: LinhaTabelaPreco[] = config.quantidadesTabela.map((q) => {
      const l = calcularLinha(input, q, porFolha, papel, config, cfg, derivados);
      const mk = l.margem;
      const ps = l.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
      return {
        quantidade: q,
        folhas: l.folhas,
        custoPapel: l.custoPapel,
        custoImpressao: l.custoImpressao,
        custoPreImp: l.custoPreImp,
        custoCorte: 0,
        custoVinco: 0,
        custoLaminacoes: l.custoAcabamentos,
        custoTotal: l.custoTotal,
        margem: mk,
        precoSemIva: ps,
        precoComIva: ps * (1 + ivaRate),
        precoUnitario: q > 0 ? ps / q : 0,
      };
    });

    // Salvaguarda anti-anomalia: o preço total nunca deve descer quando a
    // quantidade sobe (evita "comprar mais fica mais barato"). A tabela está
    // por ordem crescente de quantidade.
    for (let i = 1; i < tabela.length; i++) {
      if (tabela[i].precoSemIva < tabela[i - 1].precoSemIva) {
        const ps = tabela[i - 1].precoSemIva;
        tabela[i].precoSemIva = ps;
        tabela[i].precoComIva = ps * (1 + ivaRate);
        tabela[i].precoUnitario = tabela[i].quantidade > 0 ? ps / tabela[i].quantidade : 0;
      }
    }

    return {
      produto: 'imp_peq_formato',
      quantidade,
      cartoesPorFolha: porFolha,
      aproveitamento,
      orientacao,
      folhas: linha.folhas,
      componentes,
      custoTotal: linha.custoTotal,
      margem,
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
