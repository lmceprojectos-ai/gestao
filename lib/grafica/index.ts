import { GraficaConfig, ResultadoOrcamento } from './types';
import { calcularDerivados } from './derived';
import { getCalculator } from './registry';

export * from './types';
export { configGraficaDefault } from './config-default';
export { calcularDerivados, custoFolhaPapel, margemParaQuantidade } from './derived';
export { getCalculator, listarProdutos, registryProdutos } from './registry';

export interface CalcularOrcamentoArgs {
  produto: string;
  input: any;
  quantidade: number;
  tipoCliente: string;
  entrega24h: boolean;
  descontoManual?: number | null;
  tipoOrcamento?: string;
  config: GraficaConfig;
}

export function calcularOrcamento(args: CalcularOrcamentoArgs): ResultadoOrcamento {
  const calc = getCalculator(args.produto);
  if (!calc) throw new Error(`Produto não suportado: ${args.produto}`);
  const derivados = calcularDerivados(args.config);
  const ivaZero = (args.tipoOrcamento || 'OC').toUpperCase() === 'ONF';
  return calc.calcular(args.input, args.quantidade, args.config, derivados, {
    tipoCliente: args.tipoCliente,
    entrega24h: args.entrega24h,
    descontoManual: args.descontoManual,
    ivaZero,
  });
}
