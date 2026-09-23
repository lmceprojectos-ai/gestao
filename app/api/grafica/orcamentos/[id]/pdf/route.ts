export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { gerarHtmlOrcamento } from '@/lib/grafica/pdf-template';
import { ResultadoOrcamento } from '@/lib/grafica/types';
import { formatNumeroOrcamento, tipoTemIva, tipoOrcamentoInfo, anoDe } from '@/lib/grafica/numero';
import { gerarReferenciaMB } from '@/lib/grafica/multibanco';
import fs from 'fs';
import path from 'path';

// Carrega uma imagem de public/ como data URI (embebida no PDF, funciona em dev e produção)
const imgCache: Record<string, string | null> = {};
function carregarImagemDataUri(nome: string): string | undefined {
  if (nome in imgCache) return imgCache[nome] || undefined;
  try {
    const p = path.join(process.cwd(), 'public', nome);
    const buf = fs.readFileSync(p);
    imgCache[nome] = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    imgCache[nome] = null;
  }
  return imgCache[nome] || undefined;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    const config = await carregarConfigGrafica();
    let clienteNif: string | null = null;
    let clienteMorada: string | null = null;
    let clienteEmail: string | null = null;
    let clienteTelefone: string | null = null;
    if (orc.clienteId) {
      const cliente = await prisma.cliente.findUnique({ where: { id: orc.clienteId } });
      if (cliente) {
        clienteNif = cliente.nif;
        clienteMorada = [cliente.morada, cliente.codigoPostal, cliente.cidade].filter(Boolean).join(', ') || null;
        clienteEmail = cliente.email;
        clienteTelefone = cliente.telefone;
      }
    } else {
      // Sem cliente registado: usar os dados preenchidos diretamente no orçamento.
      clienteNif = orc.clienteNif || null;
      clienteMorada = [orc.clienteMorada, orc.clienteCodigoPostal, orc.clienteCidade].filter(Boolean).join(', ') || null;
      clienteEmail = orc.clienteEmail || null;
      clienteTelefone = orc.clienteTelefone || null;
    }

    const esp: any = orc.especificacoes || {};
    const isSticker = orc.produto === 'stickers';
    const isContratar = orc.produto === 'contratar';
    const isFlyer = orc.produto === 'imp_peq_formato';
    const papel = config.papeis.find((p) => p.id === esp.papelId);
    const isVinil = orc.produto === 'vinil';
    const substrato = config.stickers?.substratos?.find((s: any) => s.id === esp.substratoId);
    const vinilSubstrato = config.vinil?.substratos?.find((s: any) => s.id === esp.substratoId);
    const flyPapel = config.flyers?.papeis?.find((p: any) => p.id === esp.papelId);
    const papelNome = isContratar
      ? undefined
      : isFlyer
      ? (flyPapel ? `${flyPapel.tipo} ${flyPapel.gramagem}g` : esp.papelId)
      : isSticker
      ? (substrato ? substrato.descricao : esp.substratoId)
      : isVinil
      ? (vinilSubstrato ? vinilSubstrato.descricao : esp.substratoId)
      : (papel ? `${papel.nome} (${papel.larguraMm}×${papel.alturaMm})` : esp.papelId);
    const descontoLabel = config.descontosCliente.find((d) => d.tipo === orc.tipoCliente)?.label || null;

    // ---- Referência Multibanco (apenas OC/OL, que têm IVA; ONF só usa MB WAY) ----
    const comIvaDoc = tipoTemIva(orc.tipoOrcamento);
    let mbEntidade: string | null = orc.mbEntidade;
    let mbReferencia: string | null = orc.mbReferencia;
    if (comIvaDoc) {
      const ivaRate = config.iva || 0.23;
      const portesDoc = orc.portesEnvio && orc.portesEnvio > 0 ? orc.portesEnvio : 0;
      const valorIvaPortes = portesDoc * ivaRate;
      const arteDoc = orc.arteFinalValor && orc.arteFinalValor > 0 ? orc.arteFinalValor : 0;
      const valorIvaArte = arteDoc * ivaRate;
      const opcoesDoc = Array.isArray(orc.opcoesExtra) ? (orc.opcoesExtra as any[]).filter((o) => o?.incluida).reduce((s, o) => s + (Number(o?.valor) || 0), 0) : 0;
      const valorIvaOpcoes = opcoesDoc * ivaRate;
      const deslocacaoDoc = orc.deslocacao && (orc.deslocacao as any).incluir ? (Number((orc.deslocacao as any).valor) || 0) : 0;
      const valorIvaDeslocacao = deslocacaoDoc * ivaRate;
      const totalDoc = (orc.precoComIva || 0) + portesDoc + valorIvaPortes + arteDoc + valorIvaArte + opcoesDoc + valorIvaOpcoes + deslocacaoDoc + valorIvaDeslocacao;
      // Percentagem de adjudicação por-orçamento: 1..99 => a referência MB é emitida
      // para o valor da adjudicação; null/0/100 => pagamento total (comportamento anterior).
      const pctAdjOrc = orc.percentagemAdjudicacao;
      const temAdjOrc = pctAdjOrc != null && pctAdjOrc > 0 && pctAdjOrc < 100;
      const valorAPagar = temAdjOrc ? totalDoc * (pctAdjOrc as number) / 100 : totalDoc;
      const jaTem = mbEntidade && mbReferencia && orc.mbValor != null && Math.abs((orc.mbValor || 0) - valorAPagar) < 0.005;
      if (!jaTem && valorAPagar > 0) {
        const ref = await gerarReferenciaMB({
          orderId: String(orc.numero),
          amount: valorAPagar,
          description: formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt)),
          clientName: orc.clienteNome,
          clientEmail: clienteEmail,
        });
        if (ref) {
          mbEntidade = ref.entidade;
          mbReferencia = ref.referencia;
          try {
            await prisma.orcamentoGrafico.update({
              where: { id: orc.id },
              data: { mbEntidade: ref.entidade, mbReferencia: ref.referencia, mbValor: valorAPagar },
            });
          } catch (e) { console.error('Falha ao guardar referência MB:', e); }
        }
      }
    }

    const html = gerarHtmlOrcamento({
      numero: orc.numero,
      numeroFormatado: formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt)),
      tipo: orc.tipoOrcamento,
      tipoLabel: tipoOrcamentoInfo(orc.tipoOrcamento)?.label || 'Orçamento',
      comIva: tipoTemIva(orc.tipoOrcamento),
      data: orc.createdAt,
      clienteNome: orc.clienteNome,
      clienteEmpresa: orc.clienteEmpresa,
      clienteContacto: orc.clienteContacto,
      clienteNif,
      clienteMorada,
      clienteEmail,
      clienteTelefone,
      produtoLabel: orc.produto === 'cartoes' ? 'Cartões Comerciais' : orc.produto === 'stickers' ? 'Stickers / Adesivos' : orc.produto === 'contratar' ? 'Contratar (Subcontratação)' : orc.produto === 'imp_peq_formato' ? 'Flyers' : orc.produto === 'vinil' ? 'Impressão digital de grande formato' : orc.produto,
      produto: orc.produto,
      itens: Array.isArray(orc.itens) && (orc.itens as any[]).length
        ? (orc.itens as any[]).map((it) => ({
            produto: it.produto,
            especificacoes: it.especificacoes || {},
            resultado: it.breakdown as ResultadoOrcamento,
            arteFinalModo: it.arteFinalModo,
            arteFinalValor: it.arteFinalValor,
          }))
        : undefined,
      especificacoes: esp,
      resultado: orc.breakdown as unknown as ResultadoOrcamento,
      notas: orc.notas,
      config,
      papelNome,
      logoDataUri: carregarImagemDataUri('logo-criaconsensos.png'),
      cabecalhoDataUri: (config.aparenciaPdf?.cabecalhoDataUri && config.aparenciaPdf.cabecalhoDataUri.trim())
        ? config.aparenciaPdf.cabecalhoDataUri
        : carregarImagemDataUri('cabecalho-criaconsensos.png'),
      descontoLabel,
      prazoProducao: orc.prazoProducao,
      entrega24h: orc.entrega24h,
      portes: orc.portesEnvio,
      tipoPortes: orc.tipoPortes,
      arteFinalModo: orc.arteFinalModo,
      arteFinalValor: orc.arteFinalValor,
      opcoesExtra: Array.isArray(orc.opcoesExtra) ? (orc.opcoesExtra as any) : [],
      deslocacao: orc.deslocacao as any,
      mbEntidade,
      mbReferencia,
      percentagemAdjudicacao: orc.percentagemAdjudicacao ?? null,
      mbLogoDataUri: carregarImagemDataUri('mb-multibanco.png'),
      mbwayLogoDataUri: carregarImagemDataUri('mb-way.png'),
    });

    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: html,
        pdf_options: { format: 'A4', print_background: true, margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' } },
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.json().catch(() => ({ error: 'Falha ao criar pedido de PDF' }));
      return NextResponse.json({ error: err.error || 'Falha ao criar PDF' }, { status: 500 });
    }
    const { request_id } = await createResponse.json();
    if (!request_id) return NextResponse.json({ error: 'Sem request_id' }, { status: 500 });
    return NextResponse.json({ success: true, request_id });
  } catch (error: any) {
    console.error('PDF create error:', error);
    return NextResponse.json({ error: error.message || 'Falha ao gerar PDF' }, { status: 500 });
  }
}
