// Custo de deslocação / montagem no cliente (entrega + aplicação no local).
// Reproduz a lógica da folha de cálculo (Vinil / Vinil Corte):
//   custo = distância(km ida+volta) × custo/km
//         + nº técnicos × horas × custo/hora de mão de obra
// É um custo ao nível do documento (não por produto), somado ao total como
// os portes de envio. IVA aplicado quando o tipo de orçamento tem IVA.

export interface DeslocacaoResult {
  incluir: boolean;
  distanciaKm: number;
  custoKm: number;
  numTecnicos: number;
  horas: number;
  custoHora: number;
  custoDeslocacao: number; // km × €/km
  custoMaoObra: number;    // técnicos × horas × €/h
  valor: number;           // total (s/IVA)
}

const num = (v: any): number => {
  const x = Number(v);
  return isNaN(x) || x < 0 ? 0 : x;
};

/**
 * Normaliza e calcula o custo de deslocação/montagem a partir de dados brutos.
 * Devolve null quando não está incluída (para não ocupar espaço no documento).
 */
export function normalizarDeslocacao(raw: any): DeslocacaoResult | null {
  if (!raw || !raw.incluir) return null;
  const distanciaKm = num(raw.distanciaKm);
  const custoKm = num(raw.custoKm);
  const numTecnicos = num(raw.numTecnicos);
  const horas = num(raw.horas);
  const custoHora = num(raw.custoHora);
  const custoDeslocacao = distanciaKm * custoKm;
  const custoMaoObra = numTecnicos * horas * custoHora;
  const valor = custoDeslocacao + custoMaoObra;
  return {
    incluir: true,
    distanciaKm,
    custoKm,
    numTecnicos,
    horas,
    custoHora,
    custoDeslocacao,
    custoMaoObra,
    valor,
  };
}
