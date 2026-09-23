export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';

function parseJson(raw: string): any | null {
  if (!raw) return null;
  let text = String(raw).trim();
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

const LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube_shorts: 'YouTube Shorts',
};

// Estrutura esperada por plataforma (usada no prompt e para normalizar a resposta).
function esquemaPlataforma(p: string): string {
  switch (p) {
    case 'facebook':
      return `"facebook": { "mensagem": "texto da publicação (pode ter várias linhas e emojis)", "hashtags": ["#exemplo"], "chamadaAcao": "call-to-action curto" }`;
    case 'instagram':
      return `"instagram": { "legenda": "legenda apelativa", "primeiroComentario": "bloco de hashtags para o 1º comentário", "hashtags": ["#exemplo"] }`;
    case 'tiktok':
      return `"tiktok": { "legenda": "legenda curta e direta", "hashtags": ["#fyp"], "ganchos": ["gancho para os 3 primeiros segundos"] }`;
    case 'youtube_shorts':
      return `"youtube_shorts": { "titulo": "título com no máximo 100 caracteres", "descricao": "descrição do short", "tags": ["palavra-chave"] }`;
    default:
      return '';
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const brief: string = (body.brief || '').trim();
    const plataformas: string[] = Array.isArray(body.plataformas) ? body.plataformas.filter((p: string) => LABELS[p]) : [];
    const tipo: string = body.tipo === 'anuncio' ? 'anúncio pago' : 'publicação orgânica';
    const formato: string = body.formato === 'video' ? 'vídeo/short vertical' : 'imagem';
    const imagens: string[] = Array.isArray(body.imagens) ? body.imagens.filter((u: string) => typeof u === 'string' && u).slice(0, 4) : [];
    const empresa: string = body.empresa || 'KH4 3D';

    if (!brief) return NextResponse.json({ error: 'Descreva o que pretende para a publicação' }, { status: 400 });
    if (plataformas.length === 0) return NextResponse.json({ error: 'Escolha pelo menos uma plataforma' }, { status: 400 });

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 500 });

    const esquemas = plataformas.map(esquemaPlataforma).filter(Boolean).join(',\n  ');

    const prompt = `És um gestor de redes sociais profissional da empresa "${empresa}".
Escreve SEMPRE em português europeu (Portugal).
Vais criar uma ${tipo} no formato ${formato}, adaptada a CADA plataforma pedida.
${imagens.length ? `O utilizador enviou ${imagens.length} imagem(ns) de referência — analisa-as e cria conteúdo coerente com o que aparece nelas.` : ''}

PEDIDO DO UTILIZADOR:
${brief}

PLATAFORMAS PEDIDAS: ${plataformas.map((p) => LABELS[p]).join(', ')}

Regras:
- Adapta o tom e o formato a cada rede (Facebook mais informativo; Instagram visual e com hashtags no 1º comentário; TikTok curto, direto e com gancho inicial; YouTube Shorts com título forte e descrição).
- Usa emojis com moderação, quando fizer sentido.
- As hashtags devem começar por # e não ter espaços.
- Sugere também um título interno curto para identificar a publicação e uma ideia de imagem/visual.

Responde APENAS em JSON puro com esta estrutura (inclui SOMENTE as plataformas pedidas):
{
  "titulo": "título interno curto",
  "ideiaImagem": "descrição breve do visual sugerido",
  "textoBase": "texto genérico reaproveitável",
  ${esquemas}
}
Sem markdown, sem texto fora do JSON.`;

    const content: any[] = [{ type: 'text', text: prompt }];
    for (const url of imagens) {
      content.push({ type: 'image_url', image_url: { url } });
    }

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });
    if (!response.ok) {
      const t = await response.text();
      console.error('gerar-tudo LLM error:', t);
      return NextResponse.json({ error: 'Erro ao gerar o conteúdo com IA' }, { status: 502 });
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = parseJson(raw || '');
    if (!parsed) return NextResponse.json({ error: 'Não foi possível interpretar a resposta da IA' }, { status: 502 });

    // Normaliza: garante que só devolve as plataformas pedidas.
    const conteudo: Record<string, any> = {};
    for (const p of plataformas) {
      if (parsed[p]) conteudo[p] = parsed[p];
    }

    return NextResponse.json({
      success: true,
      data: {
        titulo: parsed.titulo || '',
        ideiaImagem: parsed.ideiaImagem || '',
        textoBase: parsed.textoBase || '',
        conteudoPlataformas: conteudo,
      },
    });
  } catch (error: any) {
    console.error('gerar-tudo error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
