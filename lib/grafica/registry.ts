import { ProdutoCalculator } from './types';
import { cartoesCalculator } from './produtos/cartoes';
import { stickersCalculator } from './produtos/stickers';
import { contratarCalculator } from './produtos/contratar';
import { flyersCalculator } from './produtos/flyers';
import { vinilCalculator } from './produtos/vinil';
import { livreCalculator } from './produtos/livre';
import { artigoCalculator } from './produtos/artigo';

// Registo de produtos — novos produtos (flyers, vinil, placas)
// são adicionados aqui à medida que forem implementados.
export const registryProdutos: Record<string, ProdutoCalculator> = {
  cartoes: cartoesCalculator,
  stickers: stickersCalculator,
  imp_peq_formato: flyersCalculator,
  vinil: vinilCalculator,
  contratar: contratarCalculator,
  livre: livreCalculator,
  artigo: artigoCalculator,
};

export function getCalculator(produto: string): ProdutoCalculator | null {
  return registryProdutos[produto] || null;
}

export function listarProdutos(): { id: string; label: string }[] {
  return Object.values(registryProdutos).map((p) => ({ id: p.id, label: p.label }));
}
