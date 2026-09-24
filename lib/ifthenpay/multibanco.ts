// Geração de referências Multibanco via IfThenPay (server-side).
// A chave (mbKey) é lida do ambiente: IFTHENPAY_MBKEY.

export interface ReferenciaMB {
  entidade: string;
  referencia: string;
  valor: number;
}

interface GerarArgs {
  orderId: string;
  amount: number;
  description?: string;
  clientName?: string | null;
  clientEmail?: string | null;
  url?: string;
  expiryDays?: number;
}

/**
 * Gera uma referência Multibanco através da API da IfThenPay.
 * Devolve null em caso de falha (para que a geração do PDF não seja bloqueada).
 */
export async function gerarReferenciaMB(args: GerarArgs): Promise<ReferenciaMB | null> {
  const mbKey = process.env.IFTHENPAY_MBKEY;
  if (!mbKey) {
    console.warn('[multibanco] IFTHENPAY_MBKEY não definido — referência não gerada.');
    return null;
  }
  const amountStr = (Math.round((args.amount || 0) * 100) / 100).toFixed(2);
  const payload: Record<string, any> = {
    mbKey,
    orderId: String(args.orderId).slice(0, 25),
    amount: amountStr,
    description: (args.description || `Orçamento ${args.orderId}`).slice(0, 200),
    expiryDays: String(args.expiryDays ?? 0),
  };
  if (args.url) payload.url = args.url;
  if (args.clientName) payload.clientName = args.clientName.slice(0, 200);
  if (args.clientEmail) payload.clientEmail = args.clientEmail.slice(0, 200);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch('https://api.ifthenpay.com/multibanco/reference/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[multibanco] Falha IfThenPay', resp.status, txt.slice(0, 300));
      return null;
    }
    const data: any = await resp.json().catch(() => null);
    if (!data) return null;
    // A API devolve Entity/Reference/Amount (nomes podem variar em maiúsculas/minúsculas)
    const entidade = String(data.Entity ?? data.entity ?? data.Entidade ?? '').trim();
    const referencia = String(data.Reference ?? data.reference ?? data.Referencia ?? '').trim();
    const valor = Number(data.Amount ?? data.amount ?? amountStr) || Number(amountStr);
    if (!entidade || !referencia) {
      console.error('[multibanco] Resposta sem entidade/referência', JSON.stringify(data).slice(0, 300));
      return null;
    }
    return { entidade, referencia, valor };
  } catch (e: any) {
    console.error('[multibanco] Erro ao gerar referência:', e?.message || e);
    return null;
  }
}
