// Lista de fornecedores com despesas fixas mensais.
// Para cada mês verificamos se já deu entrada uma fatura/despesa/pagamento
// correspondente. Caso contrário, o fornecedor é sinalizado como "em falta".
//
// Esta lista pode ser facilmente ampliada/reduzida no futuro.

export interface FornecedorFixo {
  /** Nome apresentado ao utilizador */
  nome: string;
  /** Palavras-chave alternativas para deteção (opcional). */
  keywords?: string[];
  /** Quantidade de faturas esperadas por mês (por omissão 1). */
  quantidadeMensal?: number;
  /**
   * Se verdadeiro, o mês corrente NÃO é sinalizado como "em falta" — usa-se
   * para obrigações cujo documento só fica disponível no mês seguinte
   * (ex.: Segurança Social, paga/declarada até ao dia 20 do mês seguinte).
   */
  naoVerificarMesCorrente?: boolean;
}

// Mês (0-indexado) a partir do qual se começa a verificar faturas fixas em falta
// no ano corrente. 3 = Abril.
export const MES_INICIO_VERIFICACAO = 3;

export const FORNECEDORES_FIXOS: FornecedorFixo[] = [
  { nome: 'IFTHENPAY', keywords: ['IFTHENPAY', 'IFTHEN'], quantidadeMensal: 3 },
  { nome: 'VODAFONE', keywords: ['VODAFONE'] },
  { nome: 'BANCO BNP PARIBAS PERSONAL FINANCE, S.A.', keywords: ['BNP PARIBAS', 'PERSONAL FINANCE', 'CETELEM'] },
  { nome: 'URBENCOMENDA TRANSPORTES LDA', keywords: ['URBENCOMENDA', 'NACEX'] },
  { nome: 'Shopify International Limited', keywords: ['SHOPIFY'] },
  { nome: 'VIA VERDE', keywords: ['VIA VERDE', 'VIAVERDE'] },
  { nome: 'V-VALLEY', keywords: ['V-VALLEY', 'VVALLEY'] },
  { nome: 'ADOBE', keywords: ['ADOBE'] },
  { nome: 'JORGE AMARAL LDA', keywords: ['JORGE AMARAL', 'JA CONSULT'] },
  { nome: 'JUVEX', keywords: ['JUVEX'] },
  { nome: 'TITULO PRINCIPAL', keywords: ['TITULO PRINCIPAL'] },
  // NOTA: os seguros (ex.: Generali Tranquilidade) são agora controlados no
  // dashboard através do módulo de Seguros (periodicidade mensal), pelo que
  // não são listados aqui como fornecedor fixo (evita contagem dupla).
  { nome: 'SEGURANÇA SOCIAL', keywords: ['SEGURANCA SOCIAL', 'SEG SOCIAL', 'SEGSOCIAL'], naoVerificarMesCorrente: true },
];

/** Remove acentos e passa a maiúsculas. */
export function normalize(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/** Normaliza e remove todos os caracteres não alfanuméricos. */
export function compact(texto: string | null | undefined): string {
  return normalize(texto).replace(/[^A-Z0-9]/g, '');
}

/** Quantidade de faturas esperadas por mês para um fornecedor fixo (mín. 1). */
export function quantidadeEsperada(f: FornecedorFixo): number {
  return f.quantidadeMensal && f.quantidadeMensal > 0 ? f.quantidadeMensal : 1;
}

/** Chaves compactas (nome + keywords) usadas na deteção de um fornecedor. */
function chavesFornecedor(f: FornecedorFixo): string[] {
  return [f.nome, ...(f.keywords ?? [])].map((k) => compact(k)).filter(Boolean);
}

/**
 * Indica se um registo (conjunto de textos de UM registo: nome do fornecedor,
 * descrição, categoria, etc.) corresponde ao fornecedor fixo indicado.
 */
export function registoCorresponde(
  textos: (string | null | undefined)[],
  f: FornecedorFixo,
): boolean {
  const compactos = (textos ?? []).map((t) => compact(t)).filter((t) => t.length > 0);
  const chaves = chavesFornecedor(f);
  return chaves.some((chave) => compactos.some((texto) => texto.includes(chave)));
}

/**
 * Devolve a lista de nomes de fornecedores fixos cuja fatura ainda NÃO deu
 * entrada, comparando com o conjunto de textos fornecido (nomes de
 * fornecedores + descrições de faturas/despesas/pagamentos do mês).
 */
export function fornecedoresFixosEmFalta(textos: (string | null | undefined)[]): string[] {
  const textosCompactos = (textos ?? [])
    .map((t) => compact(t))
    .filter((t) => t.length > 0);

  const emFalta: string[] = [];

  for (const f of FORNECEDORES_FIXOS) {
    const chaves = [f.nome, ...(f.keywords ?? [])].map((k) => compact(k)).filter(Boolean);
    const encontrado = chaves.some((chave) =>
      textosCompactos.some((texto) => texto.includes(chave)),
    );
    if (!encontrado) {
      emFalta.push(f.nome);
    }
  }

  return emFalta;
}
