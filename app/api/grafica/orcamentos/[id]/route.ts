export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { normalizarDeslocacao } from '@/lib/grafica/deslocacao';
import { processarItens } from '@/lib/grafica/itens-helper';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!data) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();

    // Alteração simples de estado / notas
    if (body.__apenasEstado) {
      const atualizado = await prisma.orcamentoGrafico.update({
        where: { id: params.id },
        data: {
          ...(body.estado ? { estado: body.estado } : {}),
          ...(body.notas !== undefined ? { notas: body.notas } : {}),
          ...(body.folhaObra !== undefined ? { folhaObra: body.folhaObra && String(body.folhaObra).trim() ? String(body.folhaObra).trim().slice(0, 60) : null } : {}),
          ...(body.percentagemAdjudicacao !== undefined ? { percentagemAdjudicacao: (body.percentagemAdjudicacao === null || body.percentagemAdjudicacao === '') ? null : Math.max(0, Math.min(100, Math.round(Number(body.percentagemAdjudicacao)))) } : {}),
        },
      });
      return NextResponse.json(atualizado);
    }

    // Recalcular por completo
    const config = await carregarConfigGrafica();
    const existente = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!existente) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    const entrega24h = !!body.entrega24h;
    const descontoManual = body.descontoManual != null ? Number(body.descontoManual) : null;
    const tipoCliente = body.tipoCliente || 'novo';
    const tipoPortes = body.tipoPortes || 'levantamento';
    const portesEnvio = tipoPortes === 'levantamento' ? null : (body.portesEnvio != null && body.portesEnvio !== '' ? Number(body.portesEnvio) : null);
    const opcoesExtra = Array.isArray(body.opcoesExtra)
      ? body.opcoesExtra.map((o: any) => ({ descricao: String(o?.descricao || '').slice(0, 200), valor: Math.max(0, Number(o?.valor) || 0), incluida: !!o?.incluida }))
      : [];
    const deslocacao = normalizarDeslocacao(body.deslocacao);

    // Usar o tipo existente como fallback quando não vier no body
    const bodyComTipo = { ...body, tipoOrcamento: body.tipoOrcamento || existente.tipoOrcamento || 'OC' };
    const { top, tipoOrcamento } = processarItens(bodyComTipo, config);

    // Se o tipo mudou, atribuir novo número na sequência do novo tipo
    let numeroTipo = existente.numeroTipo ?? undefined;
    if (tipoOrcamento !== existente.tipoOrcamento || numeroTipo == null) {
      const agg = await prisma.orcamentoGrafico.aggregate({ where: { tipoOrcamento }, _max: { numeroTipo: true } });
      numeroTipo = (agg._max.numeroTipo || 0) + 1;
    }

    const atualizado = await prisma.orcamentoGrafico.update({
      where: { id: params.id },
      data: {
        tipoOrcamento,
        numeroTipo,
        clienteId: body.clienteId || null,
        clienteNome: body.clienteNome || null,
        clienteEmpresa: body.clienteEmpresa || null,
        clienteContacto: body.clienteContacto || null,
        clienteNif: body.clienteNif || null,
        clienteEmail: body.clienteEmail || null,
        clienteTelefone: body.clienteTelefone || null,
        clienteMorada: body.clienteMorada || null,
        clienteCodigoPostal: body.clienteCodigoPostal || null,
        clienteCidade: body.clienteCidade || null,
        produto: top.produto,
        especificacoes: top.especificacoes,
        acabamentos: top.acabamentos,
        quantidade: top.quantidade,
        tipoCliente,
        entrega24h,
        descontoManual,
        tipoPortes,
        portesEnvio,
        deslocacao: deslocacao as any,
        arteFinalModo: top.arteFinalModo,
        arteFinalValor: top.arteFinalValor,
        arteFinalFicheiro: top.arteFinalFicheiro,
        arteFinalNome: top.arteFinalNome,
        opcoesExtra,
        custoTotal: top.custoTotal,
        margem: top.margem,
        precoSemIva: top.precoSemIva,
        precoComIva: top.precoComIva,
        precoUnitario: top.precoUnitario,
        breakdown: top.breakdown as any,
        tabelaPrecos: top.tabelaPrecos as any,
        itens: top.itens as any,
        ...(body.estado ? { estado: body.estado } : {}),
        ...(body.folhaObra !== undefined ? { folhaObra: body.folhaObra && String(body.folhaObra).trim() ? String(body.folhaObra).trim().slice(0, 60) : null } : {}),
        notas: body.notas ?? null,
        prazoProducao: body.prazoProducao && String(body.prazoProducao).trim() ? String(body.prazoProducao).trim().slice(0, 200) : null,
      },
    });
    return NextResponse.json(atualizado);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await prisma.orcamentoGrafico.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
