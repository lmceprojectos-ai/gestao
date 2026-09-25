// Classificação automática da categoria de faturas de fornecedor.
// Estratégia (por ordem de prioridade):
//   1) HISTÓRICO — reutiliza a categoria que o próprio utilizador já atribuiu
//      a faturas do MESMO fornecedor (por NIF e, em fallback, por nome).
//      É a fonte mais fiável porque reflete a decisão real do utilizador.
//   2) IA — para fornecedores nunca antes classificados, pede ao modelo que
//      escolha o slug de categoria mais adequado, com orientação sobre o
//      significado de "Desp. Mensais" (despesas recorrentes/subscrições).
//   3) 'outro' — quando nada permite decidir com confiança.
import { prisma } from '@/lib/db';
import { iaConfigurada, perguntarIA } from '@/lib/ai';

export interface DadosClassificacao {
  nif?: string | null;
  nome?: string | null;
  descricao?: string | null;
}

function normNome(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:()\-_/\\]/g, ' ')
    .replace(/\b(lda|ltda|unipessoal|sa|s a|inc|limited|ltd|gmbh|ug|srl|s l|sp z o o|comunicacoes pessoais|pessoais)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normNif(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

// Categoria mais frequente de um conjunto de faturas.
function maisFrequente(cats: (string | null)[]): string | null {
  const cont: Record<string, number> = {};
  for (const c of cats) {
    if (!c || c === 'outro') continue;
    cont[c] = (cont[c] || 0) + 1;
  }
  let melhor: string | null = null;
  let max = 0;
  for (const [k, v] of Object.entries(cont)) {
    if (v > max) { max = v; melhor = k; }
  }
  return melhor;
}

// 1) Procura no histórico do próprio fornecedor.
export async function categoriaPorHistorico(dados: DadosClassificacao): Promise<string | null> {
  const nif = normNif(dados.nif);
  const nomeNorm = normNome(dados.nome);

  // Por NIF (exato) — o mais fiável.
  if (nif) {
    const porNif = await prisma.fatura.findMany({
      where: {
        tipo: 'recebida',
        origem: 'fornecedor',
        entidadeNif: nif,
        NOT: [{ categoria: null }, { categoria: 'outro' }],
      },
      select: { categoria: true },
      take: 50,
    });
    const m = maisFrequente(porNif.map((f) => f.categoria));
    if (m) return m;
  }

  // Por nome normalizado — carrega candidatos já classificados e compara.
  if (nomeNorm && nomeNorm.length >= 3) {
    const candidatos = await prisma.fatura.findMany({
      where: {
        tipo: 'recebida',
        origem: 'fornecedor',
        NOT: [{ categoria: null }, { categoria: 'outro' }],
      },
      select: { categoria: true, entidadeNome: true, fornecedor: { select: { nome: true } } },
      take: 500,
    });
    const iguais = candidatos.filter((f) => {
      const n = normNome(f.entidadeNome || f.fornecedor?.nome || '');
      if (!n) return false;
      return n === nomeNorm || n.includes(nomeNorm) || nomeNorm.includes(n);
    });
    const m = maisFrequente(iguais.map((f) => f.categoria));
    if (m) return m;
  }

  return null;
}

// 1.5) Regras determinísticas por palavras-chave — cobrem fornecedores
// recorrentes/óbvios (telecom, seguros, portagens, SaaS, combustível) mesmo
// quando ainda não há histórico e sem depender da IA. Alta confiança apenas.
const REGRAS_CATEGORIA: { cat: string; termos: string[] }[] = [
  { cat: 'seguros', termos: ['seguro', 'seguros', 'generali', 'lusitania', 'fidelidade', 'tranquilidade', 'allianz', 'zurich', 'ageas', 'liberty seguros', 'una seguros', 'mapfre', 'companhia de seguros'] },
  { cat: 'financeiras', termos: ['vodafone', 'meo', 'altice', 'nowo', 'digi', 'via verde', 'viaverde', 'ifthenpay', 'adobe', 'shopify', 'openai', 'anthropic', 'microsoft', 'v valley', 'v-valley', 'cetelem', 'bnp paribas', 'leasing', 'renting', 'myfonts', 'dominios', 'dmns', 'webcraft', 'godaddy', 'dropbox', 'canva', 'figma', 'notion', 'zoom', 'mailchimp', 'sendgrid', 'twilio', 'aws', 'amazon web services', 'digitalocean', 'cloudflare', 'wetransfer'] },
  { cat: 'transportes', termos: ['urbencomenda', 'transportes lda', 'transitarios', 'dhl', 'fedex', 'chronopost', 'ctt expresso', 'seur', 'gls', 'rangel', 'transporte de mercadoria'] },
  { cat: 'combustiveis', termos: ['galp', 'repsol', 'cepsa', 'prio', 'combustivel', 'gasoleo', 'gasolina', 'abastecimento'] },
];

export function categoriaPorRegras(dados: DadosClassificacao): string | null {
  const alvo = normNome(`${dados.nome || ''} ${dados.descricao || ''}`);
  if (!alvo) return null;
  const tokens = new Set(alvo.split(' ').filter(Boolean));
  for (const regra of REGRAS_CATEGORIA) {
    for (const termo of regra.termos) {
      const t = normNome(termo);
      if (!t) continue;
      // Frases (com espaço) → procura a sequência; palavra única → palavra inteira.
      if (t.includes(' ')) {
        if (alvo.includes(t)) return regra.cat;
      } else if (tokens.has(t)) {
        return regra.cat;
      }
    }
  }
  return null;
}

// 2) Classificação por IA para fornecedores novos.
export async function categoriaPorIA(dados: DadosClassificacao): Promise<string | null> {
  if (!iaConfigurada()) return null;

  // Carrega as categorias existentes para o modelo escolher um slug válido.
  const cats = await prisma.categoria.findMany({ select: { slug: true, nome: true } });
  const slugsValidos = new Set(cats.map((c) => c.slug));
  if (slugsValidos.size === 0) return null;
  const lista = cats.map((c) => `- ${c.slug} (${c.nome})`).join('\n');

  const prompt = `És um contabilista que classifica faturas de fornecedor de uma empresa portuguesa de comunicação visual / grande formato.
Escolhe a categoria mais adequada para a seguinte fatura e responde APENAS com um objeto JSON: {"slug": "<slug>"}.

Fornecedor: ${dados.nome || 'desconhecido'}
NIF: ${dados.nif || 'desconhecido'}
Descrição: ${dados.descricao || 'sem descrição'}

Categorias disponíveis (usa exatamente um destes slugs):
${lista}

Orientação importante:
- "financeiras" (Desp. Mensais) = despesas RECORRENTES/mensais e subscrições: telecomunicações (Vodafone, MEO, NOS), software por assinatura/SaaS (Adobe, OpenAI, Shopify, Microsoft), portagens (Via Verde), rendas de instalações, financiamentos/leasing/prestações (Cetelem, BNP, bancos), comissões e serviços de cobrança (ifthenpay).
- "fornecedores" = materiais e serviços de PRODUÇÃO/consumo do negócio (telas, vinis, PVC, papel, tintas, montagens, subcontratação de produção).
- "material" = material de escritório e consumíveis genéricos.
- "seguros" = apólices e recibos de seguros.
- "transportes"/"combustiveis" = transporte de mercadorias / combustível.
- "manutencao" = reparações e manutenção de equipamentos/instalações.
- "imobilizado" = compra de equipamento/bens duradouros.
- "servicos" = serviços externos pontuais (advogados, contabilidade, consultoria).
- "marketing" = publicidade e marketing.
- Só usa "outro" se nenhuma das anteriores servir.
Responde apenas com o JSON.`;

  try {
    const content = await perguntarIA({ prompt, maxTokens: 4000, esforco: 'low' });
    let slug: string | null = null;
    try {
      const obj = JSON.parse(content);
      slug = obj?.slug ? String(obj.slug).trim() : null;
    } catch {
      const m = String(content).match(/"slug"\s*:\s*"([^"]+)"/);
      slug = m ? m[1].trim() : null;
    }
    if (slug && slugsValidos.has(slug)) return slug;
    return null;
  } catch {
    return null;
  }
}

// Ponto de entrada: devolve o slug da categoria (nunca null; 'outro' como último recurso).
export async function classificarCategoria(dados: DadosClassificacao): Promise<string> {
  try {
    const hist = await categoriaPorHistorico(dados);
    if (hist) return hist;
    const regras = categoriaPorRegras(dados);
    if (regras) return regras;
    const ia = await categoriaPorIA(dados);
    if (ia) return ia;
  } catch (e) {
    console.error('classificarCategoria erro:', e);
  }
  return 'outro';
}
