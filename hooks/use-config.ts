'use client';

import { useEffect, useState } from 'react';

export interface ConfigItem {
  id: string;
  grupo: string;
  valor: string;
  label: string;
  cor?: string | null;
  ordem: number;
  ativo: boolean;
}

// Fallback defaults so the app never renders empty selects
const FALLBACKS: Record<string, { valor: string; label: string; cor?: string }[]> = {
  forma_pagamento: [
    { valor: 'transferencia', label: 'Transferência' },
    { valor: 'multibanco', label: 'Multibanco' },
    { valor: 'mbway', label: 'MB WAY' },
    { valor: 'debito_direto', label: 'Débito Direto' },
    { valor: 'cheque', label: 'Cheque' },
    { valor: 'numerario', label: 'Numerário' },
    { valor: 'cartao', label: 'Cartão' },
    { valor: 'outro', label: 'Outro' },
  ],
  tipo_documento: [
    { valor: 'recebida', label: 'Fatura de Fornecedor' },
    { valor: 'emitida', label: 'Fatura Emitida' },
  ],
  estado: [
    { valor: 'pendente', label: 'Pendente' },
    { valor: 'pago', label: 'Pago' },
    { valor: 'parcial', label: 'Parcial' },
    { valor: 'cancelado', label: 'Cancelado' },
  ],
};

/**
 * Fetches a configuration group (forma_pagamento | tipo_documento | estado)
 * from /api/configuracoes and returns the list of items plus a label map.
 * Falls back to sensible defaults while loading or on error.
 */
export function useConfig(grupo: string) {
  const fallback = (FALLBACKS[grupo] || []).map((f, i) => ({
    id: f.valor,
    grupo,
    valor: f.valor,
    label: f.label,
    cor: f.cor ?? null,
    ordem: i,
    ativo: true,
  })) as ConfigItem[];

  const [items, setItems] = useState<ConfigItem[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/configuracoes?grupo=${encodeURIComponent(grupo)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ConfigItem[]) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setItems(data.filter((d) => d.ativo));
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [grupo]);

  const labelMap: Record<string, string> = {};
  const corMap: Record<string, string> = {};
  items.forEach((i) => {
    labelMap[i.valor] = i.label;
    if (i.cor) corMap[i.valor] = i.cor;
  });

  return { items, labelMap, corMap, loading };
}
