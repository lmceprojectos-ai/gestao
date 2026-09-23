import { uploadBufferToS3, getFileUrl } from '@/lib/s3';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';

/** Gera uma imagem com IA e devolve o URL público (S3). */
export async function gerarImagemPublica(
  descricao: string,
  aspectRatio = '1:1',
  referencias?: string[]
): Promise<{ url: string; path: string; contentType: string }> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('Serviço de IA não configurado');

  const refs = (referencias || []).filter(u => typeof u === 'string' && u).slice(0, 4);
  const prompt = `Cria uma imagem apelativa e profissional para redes sociais. ${descricao}. Alta qualidade, boa composição.${refs.length ? ' Usa as imagens fornecidas como referência visual — respeita os produtos, o logótipo, as cores e o estilo da marca que aparecem nelas.' : ''}`;
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const u of refs) content.push({ type: 'image_url', image_url: { url: u } });
  const response = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'nano_banana_pro',
      messages: [{ role: 'user', content }],
      modalities: ['image'],
      image_config: { num_images: 1, aspect_ratio: aspectRatio },
    }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error('Erro ao gerar imagem: ' + t.slice(0, 200));
  }
  const data = await response.json();
  const images = data?.choices?.[0]?.message?.images || [];
  const dataUrl: string | undefined = images?.[0]?.image_url?.url;
  if (!dataUrl || !dataUrl.startsWith('data:')) throw new Error('A IA não devolveu imagem');
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Formato de imagem inválido');
  const contentType = match[1] || 'image/png';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const { cloud_storage_path } = await uploadBufferToS3(buffer, `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, contentType, true);
  const url = await getFileUrl(cloud_storage_path, contentType, true);
  return { url, path: cloud_storage_path, contentType };
}

/** Monta um short vertical (1080x1920) a partir de várias imagens via API FFmpeg. */
export async function montarShort(imageUrls: string[], duracaoCena = 3): Promise<string> {
  const token = process.env.ABACUSAI_API_KEY;
  if (!token) throw new Error('Serviço de vídeo não configurado');
  if (imageUrls.length === 0) throw new Error('Sem imagens para o vídeo');

  const fps = 30;
  const T = 0.6; // duração do crossfade em segundos
  const L = Math.max(2, duracaoCena); // duração de cada cena
  const frames = Math.round(L * fps);

  const input_files: Record<string, string> = {};
  imageUrls.forEach((u, i) => { input_files[`in_${i + 1}`] = u; });

  // Prepara cada imagem: escala para preencher 1080x1920, corta, e aplica um leve zoom (Ken Burns).
  const prep = imageUrls
    .map((_, i) => `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='min(zoom+0.0012,1.12)':d=${frames}:s=1080x1920:fps=${fps},format=yuv420p[v${i}]`)
    .join(';');

  let filter: string;
  if (imageUrls.length === 1) {
    filter = `${prep};[v0]trim=duration=${L},setpts=PTS-STARTPTS[vout]`;
  } else {
    const chain: string[] = [];
    let last = 'v0';
    for (let i = 1; i < imageUrls.length; i++) {
      const out = i === imageUrls.length - 1 ? 'vout' : `x${i}`;
      const offset = (i * (L - T)).toFixed(2);
      chain.push(`[${last}][v${i}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`);
      last = out;
    }
    filter = `${prep};${chain.join(';')}`;
  }

  const ffmpeg_command = `${imageUrls.map((_, i) => `-i {{in_${i + 1}}}`).join(' ')} -filter_complex "${filter}" -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r ${fps} -movflags +faststart {{out_1}}`;

  const createResponse = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: token,
      input_files,
      output_files: { out_1: `short-${Date.now()}.mp4` },
      ffmpeg_command,
      max_command_run_seconds: 280,
    }),
  });
  if (!createResponse.ok) {
    const t = await createResponse.text();
    throw new Error('Erro ao iniciar montagem do vídeo: ' + t.slice(0, 200));
  }
  const { request_id } = await createResponse.json();
  if (!request_id) throw new Error('Sem identificador de pedido de vídeo');

  const maxAttempts = 240;
  for (let a = 0; a < maxAttempts; a++) {
    await new Promise(r => setTimeout(r, 1500));
    const statusResponse = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: token }),
    });
    const statusResult = await statusResponse.json();
    const status = statusResult?.status || 'FAILED';
    if (status === 'SUCCESS') {
      const url = statusResult?.result?.result?.out_1;
      if (!url) throw new Error('Vídeo concluído mas sem ficheiro de saída');
      return url as string;
    }
    if (status === 'FAILED') {
      throw new Error(statusResult?.result?.error || 'Falha na montagem do vídeo');
    }
  }
  throw new Error('Tempo esgotado ao montar o vídeo');
}
