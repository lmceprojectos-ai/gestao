// Acesso à IA (Claude, da Anthropic) para ler documentos e gerar textos.
// Substitui a API da Abacus. A chave fica em ANTHROPIC_API_KEY (.env.production).
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5';

let cliente: Anthropic | null = null;
function getCliente() {
  if (!cliente) cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cliente;
}

export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Documento ou imagem a enviar junto com o pedido.
export type Anexo =
  | { tipo: 'pdf'; base64: string }
  | { tipo: 'imagem'; base64: string; mediaType: string }
  | { tipo: 'imagem_url'; url: string };

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type TipoImagem = (typeof TIPOS_IMAGEM)[number];

function tipoImagem(mediaType: string): TipoImagem {
  const t = (mediaType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  return (TIPOS_IMAGEM as readonly string[]).includes(t) ? (t as TipoImagem) : 'image/jpeg';
}

// A API aceita imagens até 5 MB; as digitalizações passam facilmente desse valor.
// Imagens JPEG/PNG grandes vão embrulhadas numa página PDF (limite de 32 MB por pedido).
const LIMITE_IMAGEM_BASE64 = 5 * 1024 * 1024;

async function imagemParaPdf(base64: string, mediaType: TipoImagem): Promise<string | null> {
  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png') return null;
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const bytes = Buffer.from(base64, 'base64');
  const img = mediaType === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return Buffer.from(await pdf.save()).toString('base64');
}

async function prepararAnexo(a: Anexo): Promise<Anexo> {
  if (a.tipo !== 'imagem' || a.base64.length <= LIMITE_IMAGEM_BASE64) return a;
  const pdf = await imagemParaPdf(a.base64, tipoImagem(a.mediaType));
  return pdf ? { tipo: 'pdf', base64: pdf } : a;
}

function blocoAnexo(a: Anexo): Anthropic.Beta.BetaContentBlockParam {
  if (a.tipo === 'pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 } };
  }
  if (a.tipo === 'imagem') {
    return { type: 'image', source: { type: 'base64', media_type: tipoImagem(a.mediaType), data: a.base64 } };
  }
  return { type: 'image', source: { type: 'url', url: a.url } };
}

// Erro com uma mensagem já pronta para mostrar/registar (ex.: "IA 429: sem saldo").
export class ErroIA extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

// Envia um pedido e devolve o texto da resposta. Os anexos vão antes do texto,
// como a Anthropic recomenda para documentos.
export async function perguntarIA({
  prompt,
  anexos = [],
  maxTokens = 32000,
}: {
  prompt: string;
  anexos?: Anexo[];
  maxTokens?: number;
}): Promise<string> {
  if (!iaConfigurada()) throw new ErroIA('Serviço de IA não configurado (ANTHROPIC_API_KEY em falta)');

  const blocos = (await Promise.all(anexos.map(prepararAnexo))).map(blocoAnexo);

  try {
    // Em streaming para documentos longos não esbarrarem no tempo limite do pedido.
    // Se o modelo recusar por política, a Anthropic repete o pedido noutro modelo.
    const resposta = await getCliente()
      .beta.messages.stream({
        model: MODELO,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: [...blocos, { type: 'text', text: prompt }] }],
      })
      .finalMessage();

    if (resposta.stop_reason === 'refusal') {
      throw new ErroIA('A IA recusou analisar este pedido');
    }
    const texto = resposta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!texto) throw new ErroIA('A IA não devolveu qualquer conteúdo');
    return texto;
  } catch (e) {
    if (e instanceof ErroIA) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('IA: chave ANTHROPIC_API_KEY inválida', 401);
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('IA: limite de pedidos atingido, tente daqui a pouco', 429);
    if (e instanceof Anthropic.BadRequestError) throw new ErroIA(`IA 400: ${e.message.slice(0, 200)}`, 400);
    if (e instanceof Anthropic.APIError) throw new ErroIA(`IA ${e.status ?? ''}: ${e.message.slice(0, 200)}`, e.status);
    throw new ErroIA(e instanceof Error ? e.message : 'Erro ao contactar a IA');
  }
}
