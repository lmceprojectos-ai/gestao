import { calcularOrcamento } from '@/lib/grafica';
import { arteFinalValorSugerido } from '@/lib/grafica/arte-final';

// Formato guardado de `acabamentos` por produto (igual ao usado historicamente no topo).
function acabamentosShape(produto: string, input: any) {
  return produto === 'contratar' || produto === 'livre'
    ? {}
    : produto === 'imp_peq_formato'
    ? { acabamentos: input.acabamentos || [] }
    : produto === 'stickers'
    ? { tipoCorte: input.tipoCorte || 'nenhum', laminacao: !!input.laminacao }
    : produto === 'vinil'
    ? { acabamento: input.acabamento || 'Nenhum', aplicacaoNoLocal: !!input.aplicacaoNoLocal, imprimir: input.imprimir !== false }
    : { tipoCorte: input.tipoCorte || 'nenhum', vinco: !!input.vinco, laminacoes: input.laminacoes || [] };
}

/**
 * Processa os itens de um orçamento (multi-produto ou legado) recalculando no servidor.
 * Devolve os campos agregados de topo (compatíveis com o modelo antigo) + o array `itens`.
 */
export function processarItens(body: any, config: any) {
  const tipoCliente = body.tipoCliente || 'novo';
  const entrega24h = !!body.entrega24h;
  const descontoManual = body.descontoManual != null ? Number(body.descontoManual) : null;
  const tipoOrcamento = (body.tipoOrcamento || 'OC').toUpperCase();

  // Normaliza a lista de itens: novo formato (`body.itens`) ou legado (campos no topo).
  const rawItens = Array.isArray(body.itens) && body.itens.length
    ? body.itens
    : [{
        produto: body.produto,
        quantidade: body.quantidade,
        input: body.input,
        arteFinalModo: body.arteFinalModo,
        arteFinalValor: body.arteFinalValor,
        arteFinalFicheiro: body.arteFinalFicheiro,
        arteFinalNome: body.arteFinalNome,
      }];

  const itensOut = rawItens.map((it: any) => {
    const produto = it.produto || 'cartoes';
    const quantidade = Number(it.quantidade) || 0;
    const input = it.input || {};
    const arteFinalModo = ['cliente', 'criacao', 'adaptacao'].includes(it.arteFinalModo) ? it.arteFinalModo : 'cliente';
    const arteFinalValor = it.arteFinalValor != null && it.arteFinalValor !== ''
      ? Math.max(0, Number(it.arteFinalValor) || 0)
      : arteFinalValorSugerido(arteFinalModo, config);
    const arteFinalFicheiro = arteFinalModo === 'cliente' ? (it.arteFinalFicheiro || null) : null;
    const arteFinalNome = arteFinalModo === 'cliente' ? (it.arteFinalNome || null) : null;
    const resultado = calcularOrcamento({ produto, input, quantidade, tipoCliente, entrega24h, descontoManual, tipoOrcamento, config });
    return {
      produto,
      quantidade,
      especificacoes: input,
      acabamentos: acabamentosShape(produto, input),
      arteFinalModo,
      arteFinalValor,
      arteFinalFicheiro,
      arteFinalNome,
      custoTotal: resultado.custoTotal,
      margem: resultado.margem,
      precoSemIva: resultado.precoSemIva,
      precoComIva: resultado.precoComIva,
      precoUnitario: resultado.precoUnitario,
      breakdown: resultado as any,
      tabela: resultado.tabela as any,
    };
  });

  const somaSemIva = itensOut.reduce((s: number, it: any) => s + it.precoSemIva, 0);
  const somaComIva = itensOut.reduce((s: number, it: any) => s + it.precoComIva, 0);
  const somaCusto = itensOut.reduce((s: number, it: any) => s + it.custoTotal, 0);
  const somaArte = itensOut.reduce((s: number, it: any) => s + (it.arteFinalValor || 0), 0);
  const first = itensOut[0];

  const top = {
    produto: first.produto,
    especificacoes: first.especificacoes,
    acabamentos: first.acabamentos,
    quantidade: first.quantidade,
    // arteFinal* de topo: modo/ficheiro do 1º item; valor = soma (mantém totais do documento corretos).
    arteFinalModo: first.arteFinalModo,
    arteFinalValor: somaArte,
    arteFinalFicheiro: first.arteFinalFicheiro,
    arteFinalNome: first.arteFinalNome,
    custoTotal: somaCusto,
    margem: somaSemIva > 0 ? (somaSemIva - somaCusto) / somaSemIva : 0,
    precoSemIva: somaSemIva,
    precoComIva: somaComIva,
    precoUnitario: first.precoUnitario,
    breakdown: first.breakdown,
    tabelaPrecos: first.tabela,
    itens: itensOut,
  };

  return { top, tipoOrcamento };
}
