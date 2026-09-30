export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { iaConfigurada, perguntarIA } from '@/lib/ai';

/**
 * Extrai de forma robusta um objeto JSON da resposta do modelo.
 * Lida com: JSON puro, blocos markdown ```json, texto antes/depois do objeto,
 * conteúdo duplicado ou repetido a seguir ao objeto, etc.
 * Estratégia: percorre o texto e devolve o PRIMEIRO objeto {...} completo e
 * equilibrado (respeitando strings e escapes), tentando o parse a partir daí.
 */
function parseJsonFromLlm(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;

  // 1) Remover cercas de bloco markdown, se existirem
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // 2) Tentar parse direto
  try {
    return JSON.parse(text);
  } catch { /* continuar */ }

  // 3) Procurar o primeiro objeto JSON completo e equilibrado
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tipo = formData.get('tipo') as string; // 'fatura' ou 'comprovativo'

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const isPdf = mimeType === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');

    let prompt = '';

    if (tipo === 'vencimento') {
      prompt = `Analisa esta imagem de um recibo de vencimento / folha de remunerações português.
Extrai os seguintes dados e devolve APENAS um objeto JSON válido (sem markdown, sem código, sem explicações):

{
  "funcionario": "<nome completo do funcionário/trabalhador ou null>",
  "valorBruto": <remuneração bruta total como número decimal ou null>,
  "valorLiquido": <valor líquido a receber como número decimal ou null>,
  "segSocial": <desconto para Segurança Social como número decimal ou null>,
  "irs": <retenção IRS como número decimal ou null>,
  "outrosDescontos": <outros descontos como número decimal ou null>,
  "periodo": "<mês/ano de referência no formato 'MMM YYYY' (ex: 'Jun 2026') ou null>",
  "dataPagamento": "<data de pagamento no formato YYYY-MM-DD ou null>",
  "nif": "<NIF do funcionário se visível ou null>",
  "empresa": "<nome da empresa empregadora ou null>",
  "cargo": "<cargo/função do funcionário ou null>"
}

IMPORTANTE:
- O valor bruto é a remuneração antes de qualquer desconto.
- O valor líquido é o que o funcionário recebe efetivamente (bruto - descontos).
- Procura campos como "Vencimento Base", "Remuneração Bruta", "Total de Abonos", "Líquido a Receber", "Seg. Social", "IRS".
- Devolve APENAS o JSON, sem qualquer texto adicional.`;
    } else if (tipo === 'caixa') {
      prompt = `Analisa esta imagem de um talão/comprovativo bancário português relacionado com dinheiro em caixa (normalmente um talão de LEVANTAMENTO numa caixa multibanco ou ao balcão; também pode ser um depósito ou um talão de compra).
Extrai os seguintes dados e devolve APENAS um objeto JSON válido (sem markdown, sem código, sem explicações):

{
  "operacao": "<'levantamento', 'deposito', 'compra' ou 'outro'>",
  "valor": <montante da operação como número decimal ou null>,
  "data": "<data da operação no formato YYYY-MM-DD ou null>",
  "banco": "<nome do banco da conta de onde saiu/entrou o dinheiro, por extenso como aparece (ex.: 'Caixa Geral de Depósitos', 'Banco Montepio', 'Millennium bcp', 'Santander', 'Novo Banco', 'BPI', 'Crédito Agrícola') ou null>",
  "conta": "<últimos dígitos do número da conta, do cartão ou do IBAN que aparecem no talão (só os dígitos visíveis) ou null>",
  "local": "<local/terminal/agência onde foi feita a operação ou null>",
  "descricao": "<descrição curta, ex.: 'Levantamento ATM Barreiro' ou null>"
}

IMPORTANTE:
- O banco é o da CONTA/CARTÃO usado (o emissor do cartão ou o banco indicado no talão), não a rede (Multibanco/SIBS).
- Siglas comuns: CGD = Caixa Geral de Depósitos; MG/Montepio = Banco Montepio; BCP = Millennium bcp; CA = Crédito Agrícola.
- Devolve APENAS o JSON, sem qualquer texto adicional.`;
    } else if (tipo === 'comprovativo') {
      prompt = `Analisa esta imagem de um comprovativo de pagamento bancário português.
Extrai os seguintes dados e devolve APENAS um objeto JSON válido (sem markdown, sem código, sem explicações):

{
  "valor": <número decimal do montante pago ou null>,
  "data": "<data no formato YYYY-MM-DD ou null>",
  "descricao": "<descrição/referência do pagamento ou null>",
  "entidade": "<nome da entidade/beneficiário ou null>",
  "nif": "<NIF da entidade se visível ou null>",
  "iban": "<IBAN de destino se visível ou null>",
  "metodo": "<método: transferência, multibanco, mbway, cheque, etc. ou null>",
  "referencia": "<referência/número da operação ou null>"
}

IMPORTANTE: Devolve APENAS o JSON, sem qualquer texto adicional.`;
    } else {
      prompt = `Analisa esta imagem de uma fatura/documento de fornecedor português.
Extrai os seguintes dados e devolve APENAS um objeto JSON válido (sem markdown, sem código, sem explicações):

{
  "numero": "<número da fatura/documento ou null>",
  "fornecedor": "<nome do fornecedor/emissor ou null>",
  "nif": "<NIF do fornecedor ou null>",
  "valor": <valor total com IVA como número decimal ou null>,
  "valorBase": <valor sem IVA/base tributável como número decimal ou null>,
  "iva": <valor do IVA como número decimal ou null>,
  "data": "<data de emissão no formato YYYY-MM-DD ou null>",
  "dataVencimento": "<data de vencimento no formato YYYY-MM-DD ou null>",
  "descricao": "<descrição resumida dos produtos/serviços ou null>",
  "morada": "<morada do fornecedor ou null>"
}

IMPORTANTE: Devolve APENAS o JSON, sem qualquer texto adicional.`;
    }

    // Regras de precisão comuns a todos os tipos de documento
    prompt += `\n\nREGRAS DE PRECISÃO (muito importante):\n- Lê os números com máxima atenção. Em Portugal usa-se a VÍRGULA como separador decimal e o PONTO como separador de milhares (ex.: "1.234,56" corresponde a 1234.56; "12.500" corresponde a 12500). Devolve SEMPRE os valores como número decimal com ponto (ex.: 1234.56), sem símbolo de euro nem separador de milhares.\n- Distingue bem dígitos parecidos: 0/O, 1/7, 5/6/8, 3/8.\n- Se a fotografia estiver inclinada, com sombras, reflexos ou ligeiramente desfocada, analisa cuidadosamente e usa o contexto (etiquetas dos campos) para confirmar cada valor.\n- NUNCA inventes valores. Se não conseguires ler um campo com confiança, devolve null nesse campo.\n- As datas devem estar sempre no formato YYYY-MM-DD.`;

    if (!iaConfigurada()) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 500 });
    }

    let content: string;
    try {
      content = await perguntarIA({
        prompt,
        anexos: [isPdf ? { tipo: 'pdf', base64 } : { tipo: 'imagem', base64, mediaType: mimeType }],
      });
    } catch (e: any) {
      console.error('LLM API error:', e?.message);
      return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 });
    }

    const parsed = parseJsonFromLlm(content);
    if (!parsed) {
      console.error('Could not parse OCR response:', content);
      return NextResponse.json({ error: 'Não foi possível interpretar a resposta' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('OCR error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar imagem' }, { status: 500 });
  }
}
