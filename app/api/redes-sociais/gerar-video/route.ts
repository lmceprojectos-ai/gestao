export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';
import { gerarImagemPublica, montarShort } from '@/lib/social/generate';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';

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
    if (!tema) return NextResponse.json({ error: 'Indique o tema do vídeo' }, { status: 400 });
    const tom: string = body.tom || 'dinâmico e apelativo';
    const detalhes: string = (body.detalhes || '').trim();
    const plataforma: string = body.plataforma || 'TikTok/Reels/YouTube Shorts';
    const empresa: string = body.empresa || 'KH4 3D';
    // Imagens carregadas pelo utilizador (URLs públicos) e modo de utilização.
    const imagensUtilizador: string[] = Array.isArray(body.imagens) ? body.imagens.filter((u: any) => typeof u === 'string' && u) : [];
    // 'diretas' = usar exatamente as imagens carregadas como cenas do vídeo.
    // 'ia' = a IA cria as imagens, inspirando-se nas carregadas (se houver).
    const modoImagens: string = body.modoImagens === 'diretas' ? 'diretas' : 'ia';
    const usarDiretas = modoImagens === 'diretas' && imagensUtilizador.length > 0;
    let nCenas: number = parseInt(body.nCenas, 10) || 4;
    // Em modo direto, o número de cenas é igual ao número de imagens carregadas.
    nCenas = usarDiretas ? Math.min(8, Math.max(1, imagensUtilizador.length)) : Math.min(6, Math.max(2, nCenas));
    const duracaoCena: number = Math.min(5, Math.max(2, parseInt(body.duracaoCena, 10) || 3));

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 500 });

    // 1) Guião do short
    const prompt = `És um criador de conteúdos de vídeo curto (Shorts/Reels/TikTok) para a empresa "${empresa}".
Escreve em português europeu (Portugal), com tom ${tom}.
Cria o guião de um vídeo curto vertical sobre o seguinte tema.

TEMA/OBJETIVO: ${tema}
${detalhes ? `DETALHES: ${detalhes}` : ''}
PLATAFORMA: ${plataforma}

Regras:
- Divide o vídeo em exatamente ${nCenas} cenas curtas e sequenciais (com progressão lógica: gancho inicial, desenvolvimento, chamada à ação final).
- Para cada cena indica: "texto" (a frase curta que aparece/é dita nessa cena, no máximo 12 palavras) e "descricaoImagem" (descrição visual detalhada, em português, de uma imagem vertical apelativa para essa cena).
- Cria também a legenda ("legenda") para publicar junto do vídeo e 5 a 10 "hashtags" relevantes.

Responde APENAS em JSON puro:
{
  "legenda": "legenda do vídeo",
  "hashtags": ["#exemplo"],
  "cenas": [{ "texto": "...", "descricaoImagem": "..." }]
}
Sem markdown, sem texto fora do JSON.`;

    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 1800,
      }),
    });
    if (!response.ok) {
      const t = await response.text();
      console.error('LLM roteiro error:', t);
      return NextResponse.json({ error: 'Erro ao gerar o guião' }, { status: 500 });
    }
    const data = await response.json();
    const parsed = parseJson(data?.choices?.[0]?.message?.content || '');
    const cenas: { texto: string; descricaoImagem: string }[] = Array.isArray(parsed?.cenas) ? parsed.cenas.slice(0, nCenas) : [];
    // No modo direto as imagens do utilizador bastam para montar o vídeo, mesmo sem guião.
    if (cenas.length === 0 && !usarDiretas) return NextResponse.json({ error: 'Não foi possível interpretar o guião' }, { status: 500 });

    // 2) Imagens de cada cena
    let imageUrls: string[];
    if (usarDiretas) {
      // Usa exatamente as imagens carregadas pelo utilizador, pela ordem dada.
      imageUrls = imagensUtilizador.slice(0, nCenas);
    } else {
      // A IA gera uma imagem por cena (formato vertical 3:4), usando as imagens
      // carregadas (se existirem) como referência visual de produtos/marca.
      const imagens = await Promise.all(
        cenas.map(c => gerarImagemPublica(`${c.descricaoImagem}. Composição vertical para vídeo curto.`, '3:4', imagensUtilizador))
      );
      imageUrls = imagens.map(i => i.url);
    }

    // 3) Montagem do short
    const videoUrl = await montarShort(imageUrls, duracaoCena);

    return NextResponse.json({
      success: true,
      videoUrl,
      videoContentType: 'video/mp4',
      legenda: parsed?.legenda || '',
      hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags : [],
      roteiro: cenas.map((c, i) => ({ ...c, imagemUrl: imageUrls[i] })),
    });
  } catch (error: any) {
    console.error('gerar-video error:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao gerar o vídeo' }, { status: 500 });
  }
}
