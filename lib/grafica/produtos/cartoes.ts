import {
  GraficaConfig,
  CustosDerivados,
  CartoesInput,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';
import {
  custoFolhaPapel,
  margemParaQuantidade,
  custoOperacaoExcel,
  folhasHoraCorte,
  overheadPct,
  precoExcel,
} from '../derived';

// ---- Imposição: cartões por folha ----
export function calcularImposicao(
  input: CartoesInput,
  config: GraficaConfig
): { cartoesPorFolha: number; aproveitamento: number; orientacao: string } {
  const papel = config.papeis.find((p) => p.id === input.papelId);
  if (!papel) return { cartoesPorFolha: 0, aproveitamento: 0, orientacao: '—' };

  const cardW = input.larguraMm + 2 * input.sangriaMm;
  const cardH = input.alturaMm + 2 * input.sangriaMm;
  const usableW = papel.larguraMm - config.deducaoLarguraMm;
  const usableH = papel.alturaMm - 2 * config.perdaAgarreMm;

  const optA = Math.floor(usableW / cardW) * Math.floor(usableH / cardH);
  const optB = Math.floor(usableW / cardH) * Math.floor(usableH / cardW);

  const cartoesPorFolha = Math.max(optA, optB);
  const orientacao = optA >= optB ? 'Vertical' : 'Horizontal';

  const areaCartoes = cartoesPorFolha * input.larguraMm * input.alturaMm;
  const areaFolha = papel.larguraMm * papel.alturaMm;
  const aproveitamento = areaFolha > 0 ? areaCartoes / areaFolha : 0;

  return { cartoesPorFolha, aproveitamento, orientacao };
}

// ---- Custo para uma quantidade específica ----
export function calcularLinha(
  input: CartoesInput,
  quantidade: number,
  cartoesPorFolha: number,
  config: GraficaConfig,
  derivados: CustosDerivados
): LinhaTabelaPreco {
  const folhas = cartoesPorFolha > 0 ? Math.ceil(quantidade / cartoesPorFolha) : 0;
  const lados = input.frenteVerso ? 2 : 1;

  // Modelo Excel (Calculadora Cartões):
  // Papel = folhas × custo resma ÷ folhas/resma
  const custoPapel = folhas * custoFolhaPapel(config, input.papelId);

  // Impressão = folhas × clique × faces
  const clique = input.cor ? config.cliqueCor : config.cliquePB;
  const custoImpressao = folhas * lados * clique;

  // Corte = folhas × (custo hora ÷ folhas/hora) + setup
  let custoCorte = 0;
  if (input.tipoCorte && input.tipoCorte !== 'nenhum') {
    custoCorte = custoOperacaoExcel(config, folhasHoraCorte(config, input.tipoCorte), folhas);
  }

  // Vinco (corte e vinco) = folhas × (custo hora ÷ folhas/hora) + setup
  let custoVinco = 0;
  if (input.vinco) {
    custoVinco = custoOperacaoExcel(config, folhasHoraCorte(config, 'vinco'), folhas);
  }

  // Laminações = folhas × custo/folha
  let custoLaminacoes = 0;
  for (const lamId of input.laminacoes || []) {
    const lam = config.laminacoes.find((l) => l.id === lamId);
    if (lam) custoLaminacoes += folhas * lam.custoFolha;
  }

  const custoDireto = custoPapel + custoImpressao + custoCorte + custoVinco + custoLaminacoes;

  // Custos indiretos (overhead 15%) + margem por quantidade sobre o preço
  const margem = margemParaQuantidade(config, quantidade);
  const { overhead, custoTotal, precoSemIva } = precoExcel(custoDireto, overheadPct(config), margem);
  const custoPreImp = overhead;

  return {
    quantidade,
    folhas,
    custoPapel,
    custoImpressao,
    custoPreImp,
    custoCorte,
    custoVinco,
    custoLaminacoes,
    custoTotal,
    margem,
    precoSemIva,
    precoComIva: precoSemIva * (1 + config.iva),
    precoUnitario: quantidade > 0 ? precoSemIva / quantidade : 0,
  };
}

export const cartoesCalculator: ProdutoCalculator = {
  id: 'cartoes',
  label: 'Cartões Comerciais',
  calcular(input: CartoesInput, quantidade, config, derivados, opcoes): ResultadoOrcamento {
    const { cartoesPorFolha, aproveitamento, orientacao } = calcularImposicao(input, config);

    // Linha base (sem descontos) para a quantidade escolhida
    const linha = calcularLinha(input, quantidade, cartoesPorFolha, config, derivados);

    // Descontos / sobretaxas
    const descCfg = config.descontosCliente.find((d) => d.tipo === opcoes.tipoCliente);
    const descontoCliente =
      opcoes.descontoManual != null && !isNaN(opcoes.descontoManual)
        ? opcoes.descontoManual
        : descCfg
        ? descCfg.desconto
        : 0;
    const sobretaxa = opcoes.entrega24h ? config.sobretaxa24h : 0;
    // ONF (orçamento não faturado) não soma IVA
    const ivaRate = opcoes.ivaZero ? 0 : config.iva;

    const precoSemIva = linha.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = quantidade > 0 ? precoSemIva / quantidade : 0;

    // Margem efetiva após descontos (para alerta)
    const margemEfetiva = precoSemIva > 0 ? (precoSemIva - linha.custoTotal) / precoSemIva : 0;

    const componentes: ComponenteCusto[] = [
      { chave: 'papel', label: 'Papel', valor: linha.custoPapel },
      { chave: 'impressao', label: 'Impressão (cliques)', valor: linha.custoImpressao },
      { chave: 'corte', label: 'Corte', valor: linha.custoCorte },
      { chave: 'vinco', label: 'Vinco', valor: linha.custoVinco },
      { chave: 'laminacoes', label: 'Laminações', valor: linha.custoLaminacoes },
      { chave: 'preimp', label: 'Custos indiretos (15%)', valor: linha.custoPreImp },
    ].filter((c) => c.valor > 0 || ['papel', 'impressao', 'preimp'].includes(c.chave));

    // Tabela por quantidade
    const tabela: LinhaTabelaPreco[] = config.quantidadesTabela.map((q) => {
      const l = calcularLinha(input, q, cartoesPorFolha, config, derivados);
      const ps = l.precoSemIva * (1 - descontoCliente) * (1 + sobretaxa);
      return {
        ...l,
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
      produto: 'cartoes',
      quantidade,
      cartoesPorFolha,
      aproveitamento,
      orientacao,
      folhas: linha.folhas,
      componentes,
      custoTotal: linha.custoTotal,
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
