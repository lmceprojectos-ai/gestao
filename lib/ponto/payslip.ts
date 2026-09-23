// Tipos e utilitários partilhados para os recibos de remunerações.

export type PayslipEntry = {
  employeeNumber?: string | null;
  name: string;
  category?: string | null;
  salarioBase: number;
  vencimentoBase: number;
  subsAlimentacao: number;
  subsFerias: number;
  subsNatal: number;
  outrosAbonos: number;
  totalFaltas: number;
  segSocial: number;
  irs: number;
  outrosDescontos: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
  breakdown?: any;
};

export function eur(v: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(v) ? v : 0);
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Converte "AAAA-MM" em "Mês de AAAA" (ex.: "2026-06" -> "Junho de 2026").
export function monthLabel(month: string): string {
  const [y, m] = (month ?? "").split("-");
  const idx = parseInt(m, 10) - 1;
  if (!y || idx < 0 || idx > 11) return month;
  const nome = MESES[idx];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${y}`;
}

export const PAYSLIP_NUMERIC_FIELDS: (keyof PayslipEntry)[] = [
  "salarioBase", "vencimentoBase", "subsAlimentacao", "subsFerias",
  "subsNatal", "outrosAbonos", "totalFaltas", "segSocial", "irs",
  "outrosDescontos", "totalIliquido", "totalDescontos", "liquido",
];
