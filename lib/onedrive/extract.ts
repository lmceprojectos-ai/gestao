// Extração de dados estruturados a partir de documentos digitalizados, por módulo,
// usando o modelo de visão (gemini-3.1-pro-preview) via API Abacus.

export function parseJsonFromLlm(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    /* continuar */
  }
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0,
    inString = false,
    escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Especificação de campos por módulo: descreve ao modelo o que extrair.
const MODULO_SPEC: Record<string, { intro: string; campos: string }> = {
  despesa: {
    intro:
      'O documento é uma fatura, recibo ou comprovativo de uma DESPESA da empresa.',
    campos: `{
  "descricao": "<descrição curta da despesa, máx. 10 palavras>",
  "categoria": "<uma de: material, serviços, transporte, alimentação, comunicações, rendas, utilidades, outro>",
  "valor": <valor total pago/faturado com IVA, número com ponto decimal, ou null>,
  "data": "<data de emissão do documento no formato YYYY-MM-DD, ou null>",
  "entidadeNome": "<nome do emitente/fornecedor, ou null>",
  "entidadeNif": "<NIF/NIPC do emitente, apenas dígitos, ou null>"
}`,
  },
  fatura_fornecedor: {
    intro:
      'O documento é uma FATURA DE FORNECEDOR (documento emitido por um fornecedor à empresa).',
    campos: `{
  "descricao": "<descrição curta do que foi faturado, ex: 'Fatura tinteiros', máx. 10 palavras>",
  "fornecedorNome": "<nome do fornecedor emitente da fatura, ou null>",
  "fornecedorNif": "<NIF/NIPC do fornecedor, apenas dígitos, ou null>",
  "valor": <valor total da fatura com IVA, número com ponto decimal, ou null>,
  "dataFatura": "<data de emissão da fatura no formato YYYY-MM-DD, ou null>",
  "numeroFatura": "<número da fatura/documento, ou null>"
}`,
  },
  pagamento: {
    intro:
      'O documento é um COMPROVATIVO DE PAGAMENTO a um fornecedor (recibo/comprovativo de transferência).',
    campos: `{
  "descricao": "<descrição curta, ex: 'Fatura tinteiros' máx. 10 palavras>",
  "valor": <valor total a pagar com IVA, número com ponto decimal, ou null>,
  "dataPagamento": "<data da fatura no formato YYYY-MM-DD, ou null>",
  "fornecedorNome": "<nome do fornecedor emitente da fatura, ou null>",
  "fornecedorNif": "<NIF/NIPC do fornecedor, apenas dígitos, ou null>",
  "referencia": "<número da fatura/documento, ou null>"
}`,
  },
  imposto: {
    intro:
      'O documento é uma nota de liquidação, guia ou comprovativo de um IMPOSTO ou contribuição.',
    campos: `{
  "tipo": "<uma de: IVA, IRC, IRS, SegSocial, IMI, IUC, Outro>",
  "descricao": "<descrição curta, ou null>",
  "valor": <valor a pagar, número com ponto decimal, ou null>,
  "periodo": "<período a que respeita, ex: '2026-Q1' ou '2026-07', ou null>",
  "dataVencimento": "<data limite de pagamento no formato YYYY-MM-DD, ou null>",
  "entidadeNome": "<entidade emitente, ex: Autoridade Tributária, Segurança Social, ou null>",
  "entidadeNif": "<NIF, apenas dígitos, ou null>",
  "referencia": "<referência de pagamento/documento, ou null>"
}`,
  },
  seguro: {
    intro:
      'O documento é uma apólice, recibo ou aviso de pagamento de um SEGURO.',
    campos: `{
  "tipo": "<uma de: recheio, vida, acidentes_trabalho, viaturas, saude, multirriscos, outro>",
  "seguradora": "<nome da seguradora, ou null>",
  "apolice": "<número da apólice, ou null>",
  "valor": <valor do prémio a pagar, número com ponto decimal, ou null>,
  "periodicidade": "<uma de: mensal, trimestral, semestral, anual, ou null>",
  "dataInicio": "<início da cobertura no formato YYYY-MM-DD, ou null>",
  "dataVencimento": "<data limite de pagamento no formato YYYY-MM-DD, ou null>",
  "entidadeNif": "<NIF da seguradora, apenas dígitos, ou null>",
  "referencia": "<referência do recibo, ou null>"
}`,
  },
  vencimento: {
    intro:
      'O documento é um RECIBO DE VENCIMENTO / folha de remunerações de um funcionário.',
    campos: `{
  "funcionario": "<nome do funcionário, ou null>",
  "cargo": "<cargo/função, ou null>",
  "valorBruto": <remuneração bruta, número com ponto decimal, ou null>,
  "valorLiquido": <valor líquido a receber, número com ponto decimal, ou null>,
  "segSocial": <desconto para a Segurança Social, número, ou null>,
  "irs": <retenção de IRS, número, ou null>,
  "outrosDescontos": <outros descontos somados, número, ou null>,
  "periodo": "<mês a que respeita no formato YYYY-MM, ou null>",
  "dataPagamento": "<data de pagamento no formato YYYY-MM-DD, ou null>"
}`,
  },
};

const IMAGE_TYPES = ['image/tiff', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function isPdf(contentType: string, fileName: string): boolean {
  return (
    contentType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  );
}

function normalizeImageType(contentType: string, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (contentType && IMAGE_TYPES.includes(contentType)) return contentType;
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return contentType || 'image/jpeg';
}

export async function extractDados(
  modulo: string,
  buffer: Buffer,
  contentType: string,
  fileName: string
): Promise<{ dados: any; erro?: string }> {
  const spec = MODULO_SPEC[modulo];
  if (!spec) return { dados: null, erro: `Módulo desconhecido: ${modulo}` };

  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return { dados: null, erro: 'API key não configurada' };

  const prompt = `És um assistente que extrai dados de documentos financeiros portugueses.
${spec.intro}

Analisa o documento e devolve APENAS um objeto JSON válido (sem markdown nem texto adicional) no formato:
${spec.campos}

Regras de precisão:
- Para valores monetários usa o total final (com IVA quando aplicável), como número com ponto decimal (ex.: 24.50). Nunca uses subtotal, IVA isolado nem valor unitário.
- Para datas usa o formato YYYY-MM-DD.
- Para NIF/NIPC usa apenas dígitos, sem espaços.
- Nunca inventes dados: quando um campo não for legível ou não existir, devolve null nesse campo.
- Responde sempre em português nos campos de texto.`;

  const pdf = isPdf(contentType, fileName);
  const base64 = buffer.toString('base64');
  const contentPart = pdf
    ? {
        type: 'file',
        file: {
          filename: fileName || 'documento.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        },
      }
    : {
        type: 'image_url',
        image_url: {
          url: `data:${normalizeImageType(contentType, fileName)};base64,${base64}`,
          detail: 'high',
        },
      };

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gemini-3.1-pro-preview',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, contentPart],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 900,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { dados: null, erro: `LLM ${response.status}: ${errText.slice(0, 200)}` };
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = content ? parseJsonFromLlm(content) : null;
    if (!parsed) return { dados: null, erro: 'A análise não devolveu dados válidos' };
    return { dados: parsed };
  } catch (e: any) {
    return { dados: null, erro: e?.message || 'Erro ao analisar o documento' };
  }
}
