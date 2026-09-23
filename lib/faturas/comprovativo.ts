// Geração de comprovativo de pagamento (PDF) para faturas de clientes pagas via Multibanco (IfThenPay).
// Usa a API HTML2PDF da Abacus (create + poll) e devolve o buffer do PDF.

interface ComprovativoDados {
  numeroFatura?: string | null;
  descricao?: string | null;
  clienteNome?: string | null;
  clienteNif?: string | null;
  entidade?: string | null;
  referencia?: string | null;
  valor: number;
  dataPagamento: Date;
  metodo?: string | null; // rótulo do método (ex.: "Multibanco (IfThenPay)", "MB WAY (IfThenPay)")
  telemovel?: string | null; // para MB WAY
}

function fmtEUR(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function fmtData(d: Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon',
  }).format(d);
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function construirHtml(d: ComprovativoDados): string {
  const linhas: Array<[string, string]> = [];
  if (d.numeroFatura) linhas.push(['Fatura n.º', escapeHtml(d.numeroFatura)]);
  if (d.descricao) linhas.push(['Descrição', escapeHtml(d.descricao)]);
  if (d.clienteNome) linhas.push(['Cliente', escapeHtml(d.clienteNome)]);
  if (d.clienteNif) linhas.push(['NIF', escapeHtml(d.clienteNif)]);
  linhas.push(['Método de pagamento', escapeHtml(d.metodo || 'Multibanco (IfThenPay)')]);
  if (d.entidade) linhas.push(['Entidade', escapeHtml(d.entidade)]);
  if (d.referencia) linhas.push(['Referência', escapeHtml(d.referencia)]);
  if (d.telemovel) linhas.push(['Telemóvel', escapeHtml(d.telemovel)]);
  linhas.push(['Data de pagamento', fmtData(d.dataPagamento)]);

  const rows = linhas
    .map(
      ([k, v]) =>
        `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a2233; margin: 0; padding: 48px 56px; }
  .header { border-bottom: 3px solid #0f5ba7; padding-bottom: 18px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 800; color: #0f5ba7; letter-spacing: 0.5px; }
  .doc-title { font-size: 15px; color: #6b7280; margin-top: 4px; }
  .badge { display: inline-block; background: #16a34a; color: #fff; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 999px; margin-top: 14px; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 12px 10px; font-size: 13.5px; border-bottom: 1px solid #eef1f5; vertical-align: top; }
  td.k { color: #6b7280; width: 42%; font-weight: 600; }
  td.v { color: #111827; font-weight: 600; }
  .total { margin-top: 30px; background: #f1f6fb; border: 1px solid #d7e6f5; border-radius: 10px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .total .lbl { font-size: 14px; color: #0f5ba7; font-weight: 700; }
  .total .val { font-size: 26px; color: #0f5ba7; font-weight: 800; }
  .footer { margin-top: 40px; font-size: 11px; color: #9aa3b2; text-align: center; border-top: 1px solid #eef1f5; padding-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">CRIACONSENSOS</div>
    <div class="doc-title">Comprovativo de Pagamento</div>
    <span class="badge">PAGO</span>
  </div>
  <table><tbody>${rows}</tbody></table>
  <div class="total">
    <span class="lbl">Valor pago</span>
    <span class="val">${fmtEUR(d.valor)}</span>
  </div>
  <div class="footer">
    Documento gerado automaticamente na confirmação do pagamento via IfThenPay.<br/>
    Emitido em ${fmtData(new Date())}.
  </div>
</body>
</html>`;
}

/**
 * Gera o comprovativo em PDF. Devolve o buffer ou null em caso de falha.
 */
export async function gerarComprovativoPdf(
  dados: ComprovativoDados
): Promise<Buffer | null> {
  const token = process.env.ABACUSAI_API_KEY;
  if (!token) {
    console.warn('[comprovativo] ABACUSAI_API_KEY não definido — PDF não gerado.');
    return null;
  }
  const html = construirHtml(dados);
  try {
    const createResp = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: token,
        html_content: html,
        pdf_options: { format: 'A4', print_background: true, margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' } },
      }),
    });
    if (!createResp.ok) {
      console.error('[comprovativo] Falha ao criar pedido PDF', createResp.status);
      return null;
    }
    const { request_id } = await createResp.json();
    if (!request_id) {
      console.error('[comprovativo] Sem request_id');
      return null;
    }

    // Poll (máx ~60s)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const statusResp = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: token }),
      });
      if (!statusResp.ok) continue;
      const statusResult = await statusResp.json().catch(() => null);
      const status = statusResult?.status || 'FAILED';
      const result = statusResult?.result || null;
      if (status === 'SUCCESS') {
        if (result && result.result) {
          return Buffer.from(result.result, 'base64');
        }
        console.error('[comprovativo] PDF gerado sem dados');
        return null;
      }
      if (status === 'FAILED') {
        console.error('[comprovativo] Falha na geração do PDF', result?.error);
        return null;
      }
    }
    console.error('[comprovativo] Timeout à espera do PDF');
    return null;
  } catch (e: any) {
    console.error('[comprovativo] Erro:', e?.message || e);
    return null;
  }
}
