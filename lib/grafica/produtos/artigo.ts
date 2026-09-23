import {
  ArtigoInput,
  ResultadoOrcamento,
  LinhaTabelaPreco,
  ComponenteCusto,
  ProdutoCalculator,
} from '../types';
import { labelUnidadeArtigo } from '../substrato-categorias';

// Produto "Artigo / Acessório"
// Materiais que NÃO passam por impressão (distanciadores à unidade/kit, fitas
// dupla face ao metro linear, etc.). Modelo de revenda: ao custo unitário
// aplica-se uma margem (%).
//   preço bruto = custo unitário × quantidade × (1 + margem)
// Depois aplica-se o mesmo pipeline dos restantes produtos:
//   desconto de cliente → sobretaxa (entrega 24h) → IVA.
export const artigoCalculator: ProdutoCalculator = {
  id: 'artigo',
  label: 'Artigo / Acessório',
  calcular(input: ArtigoInput, quantidade, config, _derivados, opcoes): ResultadoOrcamento {
    const custoUnitario = input.custoUnitario > 0 ? input.custoUnitario : 0;
    const markup =
      input.markup != null && !isNaN(input.markup) && input.markup > 0 ? input.markup : 0;
    const qtd = quantidade > 0 ? quantidade : 1;
    const unidadeLabel = labelUnidadeArtigo(input.unidade);

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
      { chave: 'custo', label: `Custo do artigo (${unidadeLabel})`, valor: custoTotal },
      { chave: 'markup', label: `Margem aplicada (${markupPct}%)`, valor: precoBruto - custoTotal },
    ];

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
      produto: 'artigo',
      quantidade: qtd,
      cartoesPorFolha: 0,
      aproveitamento: 0,
      orientacao: '—',
      opcaoProducao: `Artigo/acessório · ${unidadeLabel}`,
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
