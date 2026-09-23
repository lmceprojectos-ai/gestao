export const dynamic = 'force-dynamic';

import { sendMail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { formatNumeroOrcamento, anoDe, tipoTemIva, tipoOrcamentoInfo } from '@/lib/grafica/numero';

function eur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
function esc(s: string) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Regista o envio de um orçamento (email ou whatsapp). Para email, envia também a mensagem ao cliente.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const modo = body?.modo === 'whatsapp' ? 'whatsapp' : 'email';
    const destino = String(body?.destino || '').trim();
    if (!destino) return NextResponse.json({ error: 'Indique o destino (email ou número).' }, { status: 400 });

    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    const config = await carregarConfigGrafica();
    const comIva = tipoTemIva(orc.tipoOrcamento);
    const ivaRate = (config as any).iva || 0.23;
    const numeroFmt = formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt as any));

    // Total do documento (mesma lógica do PDF): preço + arte-final + opções incluídas (+ IVA quando aplicável)
    const arteFinal = orc.arteFinalValor && orc.arteFinalValor > 0 ? orc.arteFinalValor : 0;
    const portes = orc.portesEnvio && orc.portesEnvio > 0 ? orc.portesEnvio : 0;
    const opcoes = Array.isArray(orc.opcoesExtra) ? (orc.opcoesExtra as any[]) : [];
    const opcoesIncluidas = opcoes.filter((o) => o?.incluida).reduce((s, o) => s + (Number(o?.valor) || 0), 0);
    const baseComIva = comIva ? orc.precoComIva : orc.precoSemIva;
    const extras = portes + arteFinal + opcoesIncluidas;
    const extrasIva = comIva ? extras * ivaRate : 0;
    const totalDoc = baseComIva + extras + extrasIva;

    const nomeCliente = orc.clienteNome || orc.clienteEmpresa || 'Cliente';
    let emailEnviado = false;
    let emailErro: string | null = null;

    if (modo === 'email') {
      const opcoesHtml = opcoes.length
        ? `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
            <tr style="background:#f1f5f9;"><th align="left" style="padding:8px;border:1px solid #e2e8f0;">Opção</th><th align="center" style="padding:8px;border:1px solid #e2e8f0;">Incluída</th><th align="right" style="padding:8px;border:1px solid #e2e8f0;">Valor</th></tr>
            ${opcoes.map((o) => `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${esc(o?.descricao || '—')}</td><td align="center" style="padding:8px;border:1px solid #e2e8f0;">${o?.incluida ? '☑' : '☐'}</td><td align="right" style="padding:8px;border:1px solid #e2e8f0;">${(Number(o?.valor) || 0) > 0 ? eur(Number(o?.valor)) : 'Sem custo'}</td></tr>`).join('')}
          </table>`
        : '';
      const mensagemLivre = body?.mensagem ? `<p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(body.mensagem)}</p>` : '';
      const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#0d9488);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.5px;">CRIACONSENSOS</h1>
            <p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px;">Orçamento ${esc(numeroFmt)}</p>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p style="font-size:14px;line-height:1.6;">Olá ${esc(nomeCliente)},</p>
            <p style="font-size:14px;line-height:1.6;">Segue o resumo do orçamento <strong>${esc(numeroFmt)}</strong>.</p>
            ${mensagemLivre}
            <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;color:#6b7280;">Produto</td><td style="padding:8px;border:1px solid #e2e8f0;" align="right">Cartões Comerciais</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;color:#6b7280;">Quantidade</td><td style="padding:8px;border:1px solid #e2e8f0;" align="right">${orc.quantidade}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;color:#6b7280;">Preço${comIva ? ' s/IVA' : ''}</td><td style="padding:8px;border:1px solid #e2e8f0;" align="right">${eur(orc.precoSemIva)}</td></tr>
              ${arteFinal > 0 ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;color:#6b7280;">Arte-final</td><td style="padding:8px;border:1px solid #e2e8f0;" align="right">${eur(arteFinal)}</td></tr>` : ''}
              ${portes > 0 ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;color:#6b7280;">Portes</td><td style="padding:8px;border:1px solid #e2e8f0;" align="right">${eur(portes)}</td></tr>` : ''}
              <tr style="background:#ecfdf5;"><td style="padding:10px 8px;border:1px solid #e2e8f0;font-weight:bold;">Total${comIva ? ' c/IVA' : ''}</td><td style="padding:10px 8px;border:1px solid #e2e8f0;font-weight:bold;color:#047857;" align="right">${eur(totalDoc)}</td></tr>
            </table>
            ${opcoes.length ? '<p style="font-size:13px;color:#6b7280;margin-bottom:4px;">Opções disponíveis (o cliente decide):</p>' : ''}
            ${opcoesHtml}
            <p style="font-size:12px;line-height:1.6;color:#6b7280;margin-top:24px;">Este orçamento é válido durante 8 dias. Para qualquer esclarecimento, responda a este email.</p>
          </div>
        </div>`;

      try {
        const result = await sendMail({
          to: destino,
          subject: `Orçamento ${numeroFmt} — CRIACONSENSOS`,
          html: htmlBody,
        });
        if (result.ok) {
          emailEnviado = true;
        } else {
          emailErro = result.error || 'Falha ao enviar email';
        }
      } catch (e: any) {
        emailErro = e?.message || 'Erro ao enviar email';
      }
      if (!emailEnviado) {
        return NextResponse.json({ error: emailErro || 'Não foi possível enviar o email' }, { status: 502 });
      }
    }

    // Registar o envio
    const registoAnterior = Array.isArray(orc.envios) ? (orc.envios as any[]) : [];
    const novoRegisto = {
      modo,
      destino,
      quando: new Date().toISOString(),
      por: (session.user as any)?.name || (session.user as any)?.email || null,
    };
    // Ao enviar (email ou whatsapp), o orçamento passa a "Em Análise" (o cliente vai analisar).
    // Não regride estados posteriores (adjudicado, produção, finalizado, recusado).
    const estadoAtual = orc.estado || 'pendente';
    const novoEstado = estadoAtual === 'rascunho' || estadoAtual === 'pendente' ? 'em_analise' : estadoAtual;

    const atualizado = await prisma.orcamentoGrafico.update({
      where: { id: params.id },
      data: { envios: [...registoAnterior, novoRegisto] as any, estado: novoEstado },
    });

    return NextResponse.json({ ok: true, envio: novoRegisto, envios: atualizado.envios, estado: atualizado.estado });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
