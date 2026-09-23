import {
  ContratarInput,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';

// Produto "Contratar" (Subcontratação)
// Modelo simples de revenda: ao custo do fornecedor aplica-se uma margem (%).
//   preço bruto = custo do fornecedor × (1 + margem)
// Em seguida aplica-se o mesmo pipeline dos restantes produtos:
//   desconto de cliente → sobretaxa (entrega 24h) → IVA.
export const contratarCalculator: ProdutoCalculator = {
  id: 'contratar',
  label: 'Contratar (Subcontratação)',
  calcular(input: ContratarInput, quantidade, config, _derivados, opcoes): ResultadoOrcamento {
    const custoUnitario = input.custoUnitario > 0 ? input.custoUnitario : 0;
    const markup =
      input.markup != null && !isNaN(input.markup) && input.markup > 0 ? input.markup : 0;
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

    const custoTotal = custoUnitario * qtd;
    const precoBruto = custoTotal * (1 + markup);
    const precoSemIva = precoBruto * (1 - descontoCliente) * (1 + sobretaxa);
    const precoComIva = precoSemIva * (1 + ivaRate);
    const precoUnitario = qtd > 0 ? precoSemIva / qtd : 0;

    const margemEfetiva = precoSemIva > 0 ? (precoSemIva - custoTotal) / precoSemIva : 0;

    const markupPct = (markup * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 });
    const componentes: ComponenteCusto[] = [
      { chave: 'fornecedor', label: 'Custo do fornecedor', valor: custoTotal },
      { chave: 'markup', label: `Margem aplicada (${markupPct}%)`, valor: precoBruto - custoTotal },
    ];

    // Tabela com uma única linha (a tabela por quantidade não faz sentido aqui)
    const tabela: LinhaTabelaPreco[] = [
      {
        quantidade: qtd,
        folhas: 0,
        custoPapel: custoTotal,
        custoImpressao: 0,
        custoPreImp: 0,
        custoCorte: 0,
        custoVinco: 0,
        custoLaminacoes: 0,
        custoTotal,
        margem: markup,
        precoSemIva,
        precoComIva,
        precoUnitario,
      },
    ];

    return {
      produto: 'contratar',
      quantidade: qtd,
      cartoesPorFolha: 0,
      aproveitamento: 0,
      orientacao: '—',
      opcaoProducao: input.fornecedor ? `Fornecedor: ${input.fornecedor}` : 'Subcontratação',
      folhasInfo: '—',
      folhas: 0,
      componentes,
      custoTotal,
      margem: markup,
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
