export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSocialAccess } from '@/lib/social/guard';

const PLATAFORMAS_VALIDAS = ['facebook', 'instagram', 'tiktok', 'youtube_shorts'];

// Devolve o estado atual das ligações (sem expor as credenciais em texto).
export async function GET() {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const linhas = await prisma.socialConnection.findMany();
    const mapa: Record<string, any> = {};
    for (const l of linhas) {
      const cred = (l.credenciais as Record<string, string>) || {};
      // Indicar apenas QUE campos estão preenchidos, nunca o valor.
      const preenchidos: Record<string, boolean> = {};
      Object.keys(cred).forEach((k) => { preenchidos[k] = !!(cred[k] && String(cred[k]).trim()); });
      mapa[l.plataforma] = {
        plataforma: l.plataforma,
        ligado: l.ligado,
        verificadoEm: l.verificadoEm,
        ultimoErro: l.ultimoErro,
        contaNome: l.contaNome,
        preenchidos,
      };
    }
    return NextResponse.json({ success: true, ligacoes: mapa });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Verifica as credenciais fazendo uma chamada real e leve à API de cada rede.
async function verificar(plataforma: string, cred: Record<string, string>): Promise<{ ok: boolean; conta?: string; erro?: string }> {
  try {
    if (plataforma === 'facebook') {
      const pageId = (cred.pageId || '').trim();
      const token = (cred.accessToken || '').trim();
      if (!pageId || !token) return { ok: false, erro: 'Preencha o ID da Página e o token de acesso.' };
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok || d?.error) return { ok: false, erro: d?.error?.message || 'Não foi possível validar a Página do Facebook.' };
      return { ok: true, conta: d?.name || pageId };
    }
    if (plataforma === 'instagram') {
      const igId = (cred.igBusinessId || '').trim();
      const token = (cred.accessToken || '').trim();
      if (!igId || !token) return { ok: false, erro: 'Preencha o ID da conta Instagram Business e o token de acesso.' };
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(igId)}?fields=username&access_token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok || d?.error) return { ok: false, erro: d?.error?.message || 'Não foi possível validar a conta Instagram Business.' };
      return { ok: true, conta: d?.username ? `@${d.username}` : igId };
    }
    if (plataforma === 'tiktok') {
      const token = (cred.accessToken || '').trim();
      if (!token) return { ok: false, erro: 'Preencha o token de acesso (access token) do TikTok.' };
      const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok || d?.error?.code && d.error.code !== 'ok') {
        return { ok: false, erro: d?.error?.message || 'Não foi possível validar a conta TikTok.' };
      }
      const nome = d?.data?.user?.display_name;
      return { ok: true, conta: nome || 'Conta TikTok' };
    }
    if (plataforma === 'youtube_shorts') {
      const apiKey = (cred.apiKey || '').trim();
      const channelId = (cred.channelId || '').trim();
      if (!apiKey || !channelId) return { ok: false, erro: 'Preencha a chave da API (API key) e o ID do canal.' };
      const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`);
      const d = await r.json();
      if (!r.ok || d?.error) return { ok: false, erro: d?.error?.message || 'Não foi possível validar o canal do YouTube.' };
      const item = Array.isArray(d?.items) && d.items[0];
      if (!item) return { ok: false, erro: 'Canal não encontrado. Confirme o ID do canal.' };
      return { ok: true, conta: item?.snippet?.title || channelId };
    }
    return { ok: false, erro: 'Plataforma desconhecida.' };
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Erro ao contactar a API da rede social.' };
  }
}

// Guarda as credenciais e verifica-as. Só marca "ligado" se a verificação passar.
export async function POST(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const body = await req.json();
    const plataforma: string = (body.plataforma || '').trim();
    if (!PLATAFORMAS_VALIDAS.includes(plataforma)) {
      return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 });
    }
    const novasCred: Record<string, string> = body.credenciais || {};

    // Reutiliza credenciais já guardadas para campos deixados em branco
    // (o cliente não reenvia valores mascarados).
    const existente = await prisma.socialConnection.findUnique({ where: { plataforma } });
    const credGuardadas = (existente?.credenciais as Record<string, string>) || {};
    const cred: Record<string, string> = { ...credGuardadas };
    for (const [k, v] of Object.entries(novasCred)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') cred[k] = String(v).trim();
    }

    const resultado = await verificar(plataforma, cred);

    const guardado = await prisma.socialConnection.upsert({
      where: { plataforma },
      create: {
        plataforma,
        credenciais: cred,
        ligado: resultado.ok,
        verificadoEm: resultado.ok ? new Date() : null,
        ultimoErro: resultado.ok ? null : resultado.erro || 'Falha na verificação',
        contaNome: resultado.conta || null,
      },
      update: {
        credenciais: cred,
        ligado: resultado.ok,
        verificadoEm: resultado.ok ? new Date() : null,
        ultimoErro: resultado.ok ? null : resultado.erro || 'Falha na verificação',
        contaNome: resultado.ok ? (resultado.conta || null) : existente?.contaNome || null,
      },
    });

    return NextResponse.json({
      success: resultado.ok,
      ligado: guardado.ligado,
      contaNome: guardado.contaNome,
      verificadoEm: guardado.verificadoEm,
      erro: resultado.ok ? null : resultado.erro,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Remove uma ligação (desliga a rede).
export async function DELETE(req: NextRequest) {
  const guard = await requireSocialAccess();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  try {
    const { searchParams } = new URL(req.url);
    const plataforma = searchParams.get('plataforma') || '';
    if (!PLATAFORMAS_VALIDAS.includes(plataforma)) {
      return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 });
    }
    await prisma.socialConnection.deleteMany({ where: { plataforma } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
