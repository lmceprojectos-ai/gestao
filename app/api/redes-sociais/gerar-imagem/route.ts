export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAccess } from '@/lib/social/guard';
import { uploadBufferToS3 } from '@/lib/s3';

export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const descricao: string = (body.descricao || '').trim();
    if (!descricao) return NextResponse.json({ error: 'Descreva a imagem pretendida' }, { status: 400 });
    const aspect: string = body.aspectRatio || '1:1';

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 500 });

    const prompt = `Cria uma imagem apelativa e profissional para uma publicação de redes sociais. ${descricao}. Alta qualidade, boa composição, adequada a Facebook/Instagram.`;

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'nano_banana_pro',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image'],
        image_config: { num_images: 1, aspect_ratio: aspect },
      }),
    });
    if (!response.ok) {
      const t = await response.text();
      console.error('LLM imagem error:', t);
      return NextResponse.json({ error: 'Erro ao gerar a imagem' }, { status: 500 });
    }
    const data = await response.json();
    const msg = data?.choices?.[0]?.message;
    const images = msg?.images || [];
    const dataUrl: string | undefined = images?.[0]?.image_url?.url;
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      console.error('Sem imagem na resposta:', JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ error: 'A IA não devolveu nenhuma imagem' }, { status: 500 });
    }
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return NextResponse.json({ error: 'Formato de imagem inválido' }, { status: 500 });
    const contentType = match[1] || 'image/png';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(match[2], 'base64');
    const { cloud_storage_path } = await uploadBufferToS3(buffer, `social-${Date.now()}.${ext}`, contentType, true);
    const { getFileUrl } = await import('@/lib/s3');
    const url = await getFileUrl(cloud_storage_path, contentType, true);
    return NextResponse.json({ success: true, imagemPath: cloud_storage_path, imagemUrl: url, imagemContentType: contentType });
  } catch (error: any) {
    console.error('gerar-imagem error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
