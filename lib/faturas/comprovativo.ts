// Geração de comprovativo de pagamento (PDF) para faturas de clientes pagas via Multibanco (IfThenPay).
// O PDF é desenhado no próprio servidor (lib/pdf/folha).
import { Folha } from '@/lib/pdf/folha';

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

/**
 * Gera o comprovativo em PDF. Devolve o buffer ou null em caso de falha.
 */
export async function gerarComprovativoPdf(
  d: ComprovativoDados
): Promise<Buffer | null> {
  try {
    const linhas: Array<[string, string]> = [];
    if (d.numeroFatura) linhas.push(['Fatura n.º', d.numeroFatura]);
    if (d.descricao) linhas.push(['Descrição', d.descricao]);
    if (d.clienteNome) linhas.push(['Cliente', d.clienteNome]);
    if (d.clienteNif) linhas.push(['NIF', d.clienteNif]);
    linhas.push(['Método de pagamento', d.metodo || 'Multibanco (IfThenPay)']);
    if (d.entidade) linhas.push(['Entidade', d.entidade]);
    if (d.referencia) linhas.push(['Referência', d.referencia]);
    if (d.telemovel) linhas.push(['Telemóvel', d.telemovel]);
    linhas.push(['Data de pagamento', fmtData(d.dataPagamento)]);

    const f = await Folha.criar('helvetica', 42);
    const x = f.margem;
    const W = f.largura;
    const azul = '#0f5ba7';
    let y = 42;

    // Cabeçalho
    f.texto('CRIACONSENSOS', x, y, { size: 22, bold: true, color: azul });
    y += 30;
    f.texto('Comprovativo de Pagamento', x, y, { size: 15, color: '#6b7280' });
    y += 26;
    const badgeW = f.medir('PAGO', 11, true) + 28;
    f.caixa(x, y, badgeW, 22, { fill: '#16a34a' });
    f.texto('PAGO', x, y + 6, { size: 11, bold: true, color: '#ffffff', align: 'center', width: badgeW });
    y += 34;
    f.linha(x, y, x + W, y, { color: azul, width: 3 });
    y += 22;

    // Tabela de dados
    const cols = [{ w: W * 0.42 }, { w: W * 0.58 }];
    for (const [k, v] of linhas) {
      const h = f.linhaTabela(x, y, cols, [{ t: k, color: '#6b7280', bold: true }, { t: v, color: '#111827', bold: true }], { size: 12, pad: 9 });
      y += h;
      f.linha(x, y, x + W, y, { color: '#eef1f5' });
    }

    // Total
    y += 26;
    f.caixa(x, y, W, 64, { fill: '#f1f6fb', border: '#d7e6f5' });
    f.texto('Valor pago', x + 22, y + 25, { size: 13, bold: true, color: azul });
    f.texto(fmtEUR(d.valor), x + 22, y + 18, { size: 24, bold: true, color: azul, align: 'right', width: W - 44 });
    y += 64 + 36;

    // Rodapé
    f.linha(x, y, x + W, y, { color: '#eef1f5' });
    y += 14;
    f.texto('Documento gerado automaticamente na confirmação do pagamento via IfThenPay.', x, y, { size: 9.5, color: '#9aa3b2', align: 'center', width: W });
    f.texto(`Emitido em ${fmtData(new Date())}.`, x, y + 13, { size: 9.5, color: '#9aa3b2', align: 'center', width: W });

    return await f.guardar();
  } catch (e: any) {
    console.error('[comprovativo] Erro:', e?.message || e);
    return null;
  }
}
