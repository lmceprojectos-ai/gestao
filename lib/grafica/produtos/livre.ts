import {
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';

// Produto "Em Branco" (texto livre)
// Linha totalmente manual: o utilizador escreve uma descrição livre e indica
// o preço unitário (sem IVA). Não há motor de custo — o preço é o que se
// escreve. Aplica-se depois o mesmo pipeline dos restantes produtos:
//   desconto de cliente → sobretaxa (entrega 24h) → IVA.
export const livreCalculator: ProdutoCalculator = {
  id: 'livre',
  label: 'Produto em Branco (texto livre)',
  calcular(input: any, quantidade, config, _derivados, opcoes): ResultadoOrcamento {
    const precoUnitBase =
      input?.precoUnitario != null && !isNaN(Number(input.precoUnitario)) && Number(input.precoUnitario) > 0
        ? Number(input.precoUnitario)
        : 0;
    const qtd = quantidade > 0 ? quantidade : 1;

    // Descontos / sobretaxas / IVA (igual aos restantes produtos)
    const descCfg = config.descontosCliente.find((d) => d.tipo === opcoes.tipoCliente);
    const descontoCliente =
      opcoes.descontoManual != null && !isNaN(opcoes.descontoManual)
        ? opcoes.descontoManual
        : descCfg
        ? descCfg.desconto
        : 0;
    const sobretaxa = opcoes.entrega24h ? config.sobretaxa24h : 0;
    const ivaRate = opcoes.ivaZero ? 0 : config.iva;

    const precoBruto = precoUnitBase * qtd;
    const precoSemIva = precoBruto * (1 - descontoCliente) * (1 + sobretaxa);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = qtd > 0 ? precoSemIva / qtd : 0;

    // Sem custo interno conhecido (linha manual).
    const custoTotal = 0;

    const componentes: ComponenteCusto[] = [
      { chave: 'manual', label: 'Valor indicado manualmente', valor: precoBruto },
    ];

    const tabela: LinhaTabelaPreco[] = [
      {
        quantidade: qtd,
        folhas: 0,
        custoPapel: 0,
        custoImpressao: 0,
        custoPreImp: 0,
        custoCorte: 0,
        custoVinco: 0,
        custoLaminacoes: 0,
        custoTotal,
        margem: 1,
        precoSemIva,
        precoComIva,
        precoUnitario,
      },
    ];

    return {
      produto: 'livre',
      quantidade: qtd,
      cartoesPorFolha: 0,
      aproveitamento: 0,
      orientacao: '—',
      opcaoProducao: 'Linha manual (texto livre)',
      folhasInfo: '—',
      folhas: 0,
      componentes,
      custoTotal,
      margem: 1,
      descontoCliente,
      sobretaxa24h: sobretaxa,
      precoSemIva,
      precoComIva,
      precoUnitario,
      abaixoMargemMinima: false,
      tabela,
    };
  },
};
