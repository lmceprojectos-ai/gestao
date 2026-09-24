// Consultas ativas (on-demand) à IfThenPay: estado de pagamentos MB WAY e lista de pagamentos.
// Permite "ir buscar" os pagamentos ao IfThenPay sem depender apenas do callback.

export interface EstadoMBWay {
  paga: boolean;
  status: string;      // ex.: "paid", "pending", "expired"
  statusCode: string;  // ex.: "000" = pago
  message: string;
  amount: number | null;
  dataPagamento: Date | null;
}

/**
 * Consulta o estado de um pedido MB WAY pelo requestId.
 * GET https://api.ifthenpay.com/spg/payment/mbway/status?mbWayKey=..&requestId=..
 * Devolve null em caso de falha de comunicação.
 */
export async function consultarEstadoMBWay(requestId: string): Promise<EstadoMBWay | null> {
  const mbWayKey = process.env.IFTHENPAY_MBWAYKEY;
  if (!mbWayKey || !requestId) return null;
  const url = `https://api.ifthenpay.com/spg/payment/mbway/status?mbWayKey=${encodeURIComponent(mbWayKey)}&requestId=${encodeURIComponent(requestId)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[ifthenpay-consultas/mbway-status] Falha', resp.status, txt.slice(0, 300));
      return null;
    }
    const data: any = await resp.json().catch(() => null);
    if (!data) return null;
    const statusCode = String(data.StatusCode ?? data.status_code ?? data.CodeStatus ?? data.Status ?? data.status ?? '').trim();
    const statusText = String(data.Status ?? data.status ?? '').trim().toLowerCase();
    const message = String(data.Message ?? data.message ?? '').trim();
    const amountRaw = data.Amount ?? data.amount;
    const amount = amountRaw != null && amountRaw !== '' ? Number(String(amountRaw).replace(',', '.')) : null;
    // Pago quando statusCode "000" ou status textual "paid".
    const paga = statusCode === '000' || statusText === 'paid';
    const dtRaw = String(data.RequestDate ?? data.updated_at ?? data.UpdatedAt ?? data.DtHrPagamento ?? '').trim();
    let dataPagamento: Date | null = null;
    if (dtRaw) {
      const d = new Date(dtRaw.replace(' ', 'T'));
      if (!isNaN(d.getTime())) dataPagamento = d;
    }
    return { paga, status: statusText || statusCode, statusCode, message, amount, dataPagamento };
  } catch (e: any) {
    console.error('[ifthenpay-consultas/mbway-status] Erro:', e?.message || e);
    return null;
  }
}

export interface PagamentoIfThenPay {
  entidade: string;
  referencia: string; // Multibanco: referência; outros métodos: orderId
  valor: number;
  id: string;
  dataPagamento: Date | null;
}

export interface ListaPagamentosResultado {
  disponivel: boolean; // false se a chave de backoffice não estiver configurada
  pagamentos: PagamentoIfThenPay[];
  erro?: string;
}

function extrairJson(texto: string): any {
  // Endpoints .asmx podem devolver o JSON dentro de <string>...</string> (XML).
  let s = texto.trim();
  if (s.startsWith('<')) {
    const m = s.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
    if (m) s = m[1];
    // descodificar entidades HTML básicas
    s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }
  s = s.trim();
  try { return JSON.parse(s); } catch { /* noop */ }
  // Último recurso: localizar o primeiro array/objeto
  const start = s.search(/[\[{]/);
  if (start >= 0) {
    try { return JSON.parse(s.slice(start)); } catch { /* noop */ }
  }
  return null;
}

function fmtData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Lista de pagamentos recebidos na IfThenPay (getPaymentsJsonV2).
 * Requer IFTHENPAY_BACKOFFICE_KEY. Se não estiver definida, devolve disponivel=false.
 */
export async function listarPagamentosIfThenPay(opts?: {
  desde?: Date;
  ate?: Date;
  referencia?: string;
}): Promise<ListaPagamentosResultado> {
  const chave = process.env.IFTHENPAY_BACKOFFICE_KEY;
  if (!chave) {
    return { disponivel: false, pagamentos: [], erro: 'IFTHENPAY_BACKOFFICE_KEY não configurada' };
  }
  const params = new URLSearchParams();
  params.set('chavebackoffice', chave);
  params.set('entidade', '');
  params.set('subentidade', '');
  params.set('dtHrInicio', opts?.desde ? fmtData(opts.desde) : '');
  params.set('dtHrFim', opts?.ate ? fmtData(opts.ate) : '');
  params.set('referencia', opts?.referencia || '');
  params.set('valor', '');
  params.set('sandbox', '0');

  const url = `https://ifthenpay.com/ifmbws/ifmbws.asmx/getPaymentsJsonV2?${params.toString()}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[ifthenpay-consultas/list] Falha', resp.status, txt.slice(0, 300));
      return { disponivel: true, pagamentos: [], erro: `HTTP ${resp.status}` };
    }
    const txt = await resp.text();
    const data = extrairJson(txt);
    if (!data) {
      console.error('[ifthenpay-consultas/list] Resposta não parseável', txt.slice(0, 300));
      return { disponivel: true, pagamentos: [], erro: 'Resposta inválida' };
    }
    const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.Payments) ? data.Payments : (Array.isArray(data?.payments) ? data.payments : []));
    const pagamentos: PagamentoIfThenPay[] = arr.map((p: any) => {
      const entidade = String(p.Entidade ?? p.entity ?? p.entidade ?? '').trim();
      const referencia = String(p.Referencia ?? p.reference ?? p.referencia ?? p.OrderId ?? p.orderId ?? '').trim();
      const valorRaw = p.Valor ?? p.amount ?? p.valor ?? p.ValorLiquido ?? 0;
      const valor = Number(String(valorRaw).replace(',', '.')) || 0;
      const id = String(p.Id ?? p.id ?? p.OrderId ?? p.orderId ?? '').trim();
      const dtRaw = String(p.DtHrPagamento ?? p.paymentDate ?? p.PaymentDate ?? p.dataPagamento ?? '').trim();
      let dataPagamento: Date | null = null;
      if (dtRaw) {
        // Formatos possíveis: "dd-MM-yyyy HH:mm:ss" ou ISO
        let iso = dtRaw;
        const m = dtRaw.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (m) iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}`;
        else iso = dtRaw.replace(' ', 'T');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) dataPagamento = d;
      }
      return { entidade, referencia, valor, id, dataPagamento };
    }).filter((p) => p.referencia || p.id);
    return { disponivel: true, pagamentos };
  } catch (e: any) {
    console.error('[ifthenpay-consultas/list] Erro:', e?.message || e);
    return { disponivel: true, pagamentos: [], erro: e?.message || 'Erro de comunicação' };
  }
}
