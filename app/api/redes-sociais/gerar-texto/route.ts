export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';
import { iaConfigurada, perguntarIA } from '@/lib/ai';

function parseJson(raw: string): any | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const tema: string = (body.tema || '').trim();
    if (!tema) return NextResponse.json({ error: 'Indique o tema da publicação' }, { status: 400 });
    const tom: string = body.tom || 'profissional e próximo';
    const plataformas: string = body.plataformas || 'facebook';
    const tipo: string = body.tipo === 'anuncio' ? 'anúncio pago' : 'publicação orgânica';
    const detalhes: string = (body.detalhes || '').trim();
    const empresa: string = body.empresa || 'KH4 3D';

    if (!iaConfigurada()) return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 500 });

    const prompt = `És um gestor de redes sociais profissional para a empresa "${empresa}".
Escreve em português europeu (Portugal), com tom ${tom}.
Cria uma ${tipo} para as plataformas: ${plataformas}.

TEMA/OBJETIVO: ${tema}
${detalhes ? `DETALHES ADICIONAIS: ${detalhes}` : ''}

Regras:
- O texto principal deve ser cativante, claro e adequado a ${plataformas}.
- Usa emojis com moderação quando fizer sentido.
- Inclui uma chamada à ação quando apropriado.
- Cria 2 variantes alternativas mais curtas.
- Sugere entre 5 a 10 hashtags relevantes (sem espaços, com #).
- Sugere uma ideia de imagem para acompanhar a publicação (descrição breve, em português).

Responde APENAS em JSON puro com esta estrutura:
{
  "texto": "texto principal da publicação",
  "variacoes": ["variante 1", "variante 2"],
  "hashtags": ["#exemplo", "#outra"],
  "ideiaImagem": "descrição breve da imagem sugerida"
}
Sem markdown, sem texto fora do JSON.`;

    let content: string;
    try {
      content = await perguntarIA({ prompt, maxTokens: 16000 });
    } catch (e: any) {
      console.error('LLM texto error:', e?.message);
      return NextResponse.json({ error: 'Erro ao gerar o texto' }, { status: 500 });
    }
    const parsed = parseJson(content || '');
    if (!parsed) return NextResponse.json({ error: 'Não foi possível interpretar a resposta da IA' }, { status: 500 });
    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('gerar-texto error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
