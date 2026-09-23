// Tipos de orçamento e formatação do número (partilhado servidor/cliente)

export interface TipoOrcamento {
  id: string;
  label: string;
  descricao: string;
  comIva: boolean;
}

export const TIPOS_ORCAMENTO: TipoOrcamento[] = [
  {
    id: 'OC',
    label: 'Orçamento de Clientes (OC)',
    descricao: 'Orçamento normal para cliente, com IVA.',
    comIva: true,
  },
  {
    id: 'ONF',
    label: 'Orçamento não faturado (ONF)',
    descricao: 'Não soma IVA. Serve apenas para controlo interno de totais.',
    comIva: false,
  },
  {
    id: 'OL',
    label: 'Orçamento Livre (OL)',
    descricao: 'Orçamento livre, com IVA.',
    comIva: true,
  },
];

export function tipoOrcamentoInfo(tipo?: string | null): TipoOrcamento {
  return TIPOS_ORCAMENTO.find((t) => t.id === tipo) || TIPOS_ORCAMENTO[0];
}

/** ONF não soma IVA. */
export function tipoTemIva(tipo?: string | null): boolean {
  return tipoOrcamentoInfo(tipo).comIva;
}

/** Ex.: 'OC n.º 0001/2026' */
export function formatNumeroOrcamento(tipo?: string | null, numeroTipo?: number | null, ano?: number | null): string {
  const t = (tipo || 'OC').toUpperCase();
  const n = numeroTipo != null ? String(numeroTipo).padStart(4, '0') : '----';
  const y = ano != null && !isNaN(Number(ano)) ? `/${ano}` : '';
  return `${t} n.º ${n}${y}`;
}

/** Extrai o ano (YYYY) de uma data/ISO string de forma independente do fuso. */
export function anoDe(data?: string | Date | null): number | null {
  if (!data) return null;
  const iso = typeof data === 'string' ? data : new Date(data).toISOString();
  const y = Number(String(iso).slice(0, 4));
  return isNaN(y) ? null : y;
}
