// Início de pagamento MB WAY via IfThenPay (server-side).
// A chave (mbWayKey) é lida do ambiente: IFTHENPAY_MBWAYKEY.
// API REST v2.0: POST https://api.ifthenpay.com/spg/payment/mbway

export interface ResultadoMBWay {
  requestId: string;
  status: string; // "000" = pedido aceite (a aguardar confirmação na app MB WAY)
  message: string;
  amount: number;
}

interface IniciarArgs {
  orderId: string;
  amount: number;
  mobileNumber: string; // já normalizado (ex.: "351#912345678")
  description?: string;
  email?: string | null;
}

/**
 * Normaliza um número de telemóvel para o formato IfThenPay "351#912345678".
 * Aceita entradas como "912345678", "+351 912 345 678", "351912345678".
 * Devolve null se não for possível obter 9 dígitos nacionais.
 */
export function normalizarTelemovel(input: string): string | null {
  if (!input) return null;
  let s = String(input).replace(/[^0-9+]/g, '');
  s = s.replace(/^\+/, '');
  let indicativo = '351';
  // Se já vem com indicativo (12 dígitos começando por 351) separa-o
  if (s.length > 9) {
    // assume os últimos 9 dígitos como número nacional
    indicativo = s.slice(0, s.length - 9) || '351';
    s = s.slice(-9);
  }
  if (s.length !== 9) return null;
  return `${indicativo}#${s}`;
}

/**
 * Inicia um pagamento MB WAY. Devolve o resultado ou null em caso de falha.
 */
export async function iniciarPagamentoMBWay(args: IniciarArgs): Promise<ResultadoMBWay | null> {
  const mbWayKey = process.env.IFTHENPAY_MBWAYKEY;
  if (!mbWayKey) {
    console.warn('[mbway] IFTHENPAY_MBWAYKEY não definido — pagamento não iniciado.');
    return null;
  }
  const amountStr = (Math.round((args.amount || 0) * 100) / 100).toFixed(2);
  const payload: Record<string, any> = {
    mbWayKey,
    orderId: String(args.orderId).slice(0, 15),
    amount: amountStr,
    mobileNumber: args.mobileNumber,
    description: (args.description || `Fatura ${args.orderId}`).slice(0, 200),
  };
  if (args.email) payload.email = String(args.email).slice(0, 200);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch('https://api.ifthenpay.com/spg/payment/mbway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[mbway] Falha IfThenPay', resp.status, txt.slice(0, 300));
      return null;
    }
    const data: any = await resp.json().catch(() => null);
    if (!data) return null;
    const requestId = String(data.RequestId ?? data.requestId ?? '').trim();
    const status = String(data.Status ?? data.status ?? '').trim();
    const message = String(data.Message ?? data.message ?? '').trim();
    const amount = Number(data.Amount ?? data.amount ?? amountStr) || Number(amountStr);
    if (!requestId) {
      console.error('[mbway] Resposta sem RequestId', JSON.stringify(data).slice(0, 300));
      return null;
    }
    return { requestId, status, message, amount };
  } catch (e: any) {
    console.error('[mbway] Erro ao iniciar pagamento:', e?.message || e);
    return null;
  }
}
