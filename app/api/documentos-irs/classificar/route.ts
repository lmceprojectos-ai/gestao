export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Classifica automaticamente um documento de IRS numa categoria conhecida,
// usando o modelo de visão. Recebe o ficheiro em base64.

const CATEGORIAS: Record<string, string> = {
  recibos: 'Recibo de vencimento / folha de remunerações',
  declaracao_rendimentos: 'Declaração anual de rendimentos e retenções da entidade patronal',
  comprovativo_irs: 'Comprovativo de IRS retido na fonte',
  comprovativo_ss: 'Comprovativo de descontos para a Segurança Social',
  irs_jovem: 'Documento relativo ao regime IRS Jovem',
  maiores_65: 'Documento relativo a benefícios para maiores de 65 anos',
  saude: 'Despesa de saúde (fatura de médico, farmácia, clínica, hospital, ótica, dentista, análises, fisioterapia)',
  educacao: 'Despesa de educação (propinas, material escolar, explicações, creche)',
  habitacao: 'Habitação (recibo de renda ou juros de crédito à habitação)',
  dependentes: 'Documento relativo a dependentes',
  outro: 'Outro documento fiscal não classificado',
};

function parseJsonFromLlm(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch { /* continuar */ }
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

// Normaliza uma data em vários formatos comuns em documentos portugueses para
// ISO (YYYY-MM-DD). Aceita YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY e
// variantes com ano a 2 dígitos. Devolve null se não for uma data válida.
function normalizarData(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const txt = raw.trim();
  if (!txt) return null;

  const validar = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return null;
    // Rejeita datas impossíveis (ex.: 31/02) e futuras irrealistas
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return null;
    return iso;
  };

  const expandirAno = (a: string): number => {
    const n = Number(a);
    if (a.length === 4) return n;
    // Ano a 2 dígitos: assume século 20xx
    return 2000 + n;
  };

  // Formato ISO YYYY-MM-DD (ou YYYY/MM/DD)
  let m = txt.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validar(Number(m[1]), Number(m[2]), Number(m[3]));

  // Formato PT: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (ano 2 ou 4 dígitos)
  m = txt.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return validar(expandirAno(m[3]), Number(m[2]), Number(m[1]));

  // Fallback: tenta Date.parse para formatos ISO com tempo
  const isoOnly = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoOnly) return validar(Number(isoOnly[1]), Number(isoOnly[2]), Number(isoOnly[3]));

  return null;
}

// Converte um valor monetário (número ou string com símbolos, separadores PT) num Float.
function normalizarValor(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  }
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  // Remove símbolos de moeda, texto e espaços
  s = s.replace(/eur/gi, '').replace(/[€$£]/g, '').replace(/\s/g, '');
  // Mantém apenas dígitos, vírgulas, pontos e sinal
  s = s.replace(/[^0-9.,-]/g, '');
  if (!s) return null;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // O último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // vírgula decimal -> remove pontos de milhares
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // ponto decimal -> remove vírgulas de milhares
      s = s.replace(/,/g, '');
    }
  } else if (temVirgula) {
    // Só vírgula: assume decimal PT
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

async function chamarModelo(model: string, prompt: string, isPdf: boolean, contentType: string, base64: string, fileName: string, apiKey: string) {
  return fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            isPdf
              ? { type: 'file', file: { filename: fileName || 'documento.pdf', file_data: `data:application/pdf;base64,${base64}` } }
              : { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 900,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const base64: string = body.fileBase64 || '';
    const contentType: string = body.contentType || 'image/jpeg';
    const fileName: string = body.fileName || 'documento';
    if (!base64) return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 });

    const isPdf = contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

    const listaCategorias = Object.entries(CATEGORIAS).map(([k, v]) => `- "${k}": ${v}`).join('\n');
    const prompt = `És um perito em contabilidade e fiscalidade portuguesa, especializado em ler faturas, recibos e faturas-recibo (incluindo talões em papel térmico de farmácias e clínicas, muitas vezes com má qualidade de digitalização). Analisa cuidadosamente TODO o documento, incluindo o cabeçalho, o rodapé e as linhas de totais.

Escolhe A CATEGORIA MAIS ADEQUADA de entre a lista seguinte:
${listaCategorias}

Devolve APENAS um objeto JSON válido, sem markdown nem texto adicional, no formato:
{
  "categoria": "<uma das chaves acima, ex: saude>",
  "descricao": "<descrição curta do documento>",
  "entidadeNome": "<nome do emitente/prestador, ex: clínica, farmácia, médico>",
  "valor": <valor total pago como número, sem símbolo de moeda, ou null>,
  "dataDocumento": "<data de emissão, ou null>"
}

Regras de precisão (segue-as rigorosamente):
- CATEGORIA: usa exatamente uma das chaves indicadas (minúsculas, com underscore). Se for uma fatura de farmácia, médico, clínica, hospital, laboratório de análises, dentista, ótica, fisioterapia ou outra despesa de saúde, usa "saude". Se não tiveres a certeza, usa "outro".
- ENTIDADE: identifica o NOME do EMITENTE/PRESTADOR do serviço (a empresa/profissional que emitiu o documento e recebeu o pagamento), normalmente no topo junto ao logótipo e ao NIF do emitente. NUNCA uses o nome do cliente/utente/destinatário (que costuma aparecer em "Exmo(a). Sr(a).", "Cliente", "Adquirente" ou junto a "NIF do adquirente").
- VALOR: usa o TOTAL FINAL EFETIVAMENTE PAGO, com IVA incluído. Procura termos como "Total a pagar", "Total", "Valor total", "Total do documento", "A pagar", "Total c/ IVA". NÃO uses subtotais, "Base tributável", "Valor sem IVA", o IVA isolado, comparticipações, nem valores unitários por artigo. Em talões de farmácia, o valor relevante é o total efetivamente pago pelo utente (após comparticipação, se aplicável). Devolve um número JSON com ponto decimal (ex.: 24.50).
- DATA: usa a DATA DE EMISSÃO do documento (não a data de vencimento nem de validade). Devolve preferencialmente no formato YYYY-MM-DD; se só conseguires ler no formato português, devolve DD/MM/YYYY. Não inventes.
- Nunca inventes dados: quando a categoria, nome, valor ou data não forem legíveis com confiança, devolve null nesse campo (exceto categoria, que nesse caso é "outro").
- A descrição deve ser curta (máx. 8 palavras), em português, e refletir o tipo de despesa (ex.: "Fatura de farmácia", "Consulta de medicina dentária").`;

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key não configurada' }, { status: 500 });

    // Deteta a falta de créditos do serviço de IA para devolver uma mensagem clara.
    const semCreditos = (txt: string) => /no remaining credits|insufficient credits|quota/i.test(txt || '');
    const MSG_SEM_CREDITOS = 'A análise automática está temporariamente indisponível por falta de créditos do serviço de inteligência artificial. Pode preencher os dados manualmente (categoria, entidade, valor e data) e guardar o documento normalmente.';

    // Tenta com o modelo principal; em caso de falha de rede/servidor, tenta um modelo alternativo.
    let response = await chamarModelo('gemini-3.1-pro-preview', prompt, isPdf, contentType, base64, fileName, apiKey);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Classificar LLM error (principal):', response.status, errText);
      if (semCreditos(errText)) {
        return NextResponse.json({ error: MSG_SEM_CREDITOS, semCreditos: true }, { status: 503 });
      }
      // Retry legítimo com modelo alternativo
      response = await chamarModelo('gemini-3.5-flash', prompt, isPdf, contentType, base64, fileName, apiKey);
      if (!response.ok) {
        const errText2 = await response.text();
        console.error('Classificar LLM error (alternativo):', response.status, errText2);
        if (semCreditos(errText2)) {
          return NextResponse.json({ error: MSG_SEM_CREDITOS, semCreditos: true }, { status: 503 });
        }
        return NextResponse.json({ error: 'Não foi possível analisar o documento' }, { status: 502 });
      }
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = content ? parseJsonFromLlm(content) : null;
    if (!parsed) return NextResponse.json({ error: 'A análise não devolveu dados válidos' }, { status: 422 });

    let categoria = parsed.categoria;
    if (!categoria || !Object.prototype.hasOwnProperty.call(CATEGORIAS, categoria)) categoria = 'outro';
    const descricao = typeof parsed.descricao === 'string' ? parsed.descricao.slice(0, 120) : '';
    const entidadeNome = typeof parsed.entidadeNome === 'string' && parsed.entidadeNome.trim()
      ? parsed.entidadeNome.trim().slice(0, 160)
      : null;
    const valor = normalizarValor(parsed.valor);
    const dataDocumento = normalizarData(parsed.dataDocumento);
    return NextResponse.json({ categoria, descricao, entidadeNome, valor, dataDocumento });
  } catch (error: any) {
    console.error('Classificar error:', error);
    return NextResponse.json({ error: 'Erro ao processar a análise do documento' }, { status: 500 });
  }
}
