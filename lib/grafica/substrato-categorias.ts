// Categorias do catálogo de substratos (partilhadas entre a configuração e o
// formulário de orçamentos). Cada substrato pode ser classificado numa destas
// categorias para facilitar a organização e a escolha nos orçamentos.
export const SUBSTRATO_CATEGORIAS: string[] = [
  'Adesivos para Digital pequeno formato',
  'Adesivos de corte',
  'Adesivos Impressão Digital',
  'Proteção, plastificação e laminação',
  'Papéis',
  'Cartolinas',
  'Placas e Suportes Rígidos',
  'Acessórios de fixação',
  'Lonas e acessórios',
];

// Rótulo apresentado quando um substrato ainda não tem categoria atribuída.
export const SUBSTRATO_SEM_CATEGORIA = 'Sem categoria';

// Unidade de venda de um substrato/material (como é comprado ao fornecedor).
// É informação de organização — o cálculo do orçamento continua a usar o €/m²
// (ou preço rolo/folhas) de cada material; esta etiqueta indica em que unidade
// o material é adquirido.
export const UNIDADES_SUBSTRATO: { value: string; label: string }[] = [
  { value: 'rolo', label: 'Rolo' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'folha', label: 'Folha' },
  { value: 'm2', label: 'm²' },
];

// Unidade de venda de um artigo/acessório (linha somável no orçamento).
export const UNIDADES_ARTIGO: { value: string; label: string }[] = [
  { value: 'un', label: 'Unidade' },
  { value: 'kit', label: 'Kit' },
  { value: 'metro', label: 'Metro linear' },
];

export function labelUnidadeArtigo(u?: string): string {
  return UNIDADES_ARTIGO.find((x) => x.value === u)?.label || 'Unidade';
}

// Infere a categoria mais provável a partir da «aplicação» do substrato.
// Usada como pré-preenchimento quando o substrato ainda não tem categoria.
export function categoriaPadraoSubstrato(s: { aplicacao?: string; maquina?: string }): string {
  const a = (s?.aplicacao || '').toLowerCase();
  if (a.includes('lamina')) return 'Proteção, plastificação e laminação';
  if (a.includes('lona')) return 'Lonas e acessórios';
  if (a.includes('transporte') || a.includes('pelicula') || a.includes('película')) return 'Acessórios de fixação';
  if (a.includes('laser')) return 'Adesivos para Digital pequeno formato';
  if (a.includes('recort') && a.includes('impress')) return 'Adesivos Impressão Digital';
  if (a.includes('corte') || a.includes('fosco')) return 'Adesivos de corte';
  if (a.includes('microperf') || a.includes('sinal') || a.includes('impress')) return 'Adesivos Impressão Digital';
  return 'Adesivos Impressão Digital';
}
