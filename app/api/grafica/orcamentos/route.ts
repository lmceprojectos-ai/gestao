export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { normalizarDeslocacao } from '@/lib/grafica/deslocacao';
import { processarItens } from '@/lib/grafica/itens-helper';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const estado = searchParams.get('estado') || '';
    const tipo = (searchParams.get('tipo') || '').trim().toUpperCase();
    const where: any = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipoOrcamento = tipo;
    if (q) {
      const asNum = parseInt(q, 10);
      where.OR = [
        { clienteNome: { contains: q } },
        { clienteEmpresa: { contains: q } },
        { folhaObra: { contains: q } },
        { notas: { contains: q } },
        ...(isNaN(asNum) ? [] : [{ numero: asNum }]),
      ];
    }
    const data = await prisma.orcamentoGrafico.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    const config = await carregarConfigGrafica();

    const tipoCliente = body.tipoCliente || 'novo';
    const entrega24h = !!body.entrega24h;
    const descontoManual = body.descontoManual != null ? Number(body.descontoManual) : null;
    const tipoPortes = body.tipoPortes || 'levantamento';
    const portesEnvio = tipoPortes === 'levantamento' ? null : (body.portesEnvio != null && body.portesEnvio !== '' ? Number(body.portesEnvio) : null);
    const opcoesExtra = Array.isArray(body.opcoesExtra)
      ? body.opcoesExtra.map((o: any) => ({ descricao: String(o?.descricao || '').slice(0, 200), valor: Math.max(0, Number(o?.valor) || 0), incluida: !!o?.incluida }))
      : [];
    const deslocacao = normalizarDeslocacao(body.deslocacao);

    // Processar itens (multi-produto) + recalcular no servidor (fonte da verdade)
    const { top, tipoOrcamento } = processarItens(body, config);

    // Numeração sequencial independente por tipo (OC / ONF / OL)
    const agg = await prisma.orcamentoGrafico.aggregate({
      where: { tipoOrcamento },
      _max: { numeroTipo: true },
    });
    const numeroTipo = (agg._max.numeroTipo || 0) + 1;

    const criado = await prisma.orcamentoGrafico.create({
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
        estado: body.estado || 'pendente',
        notas: body.notas || null,
        prazoProducao: body.prazoProducao && String(body.prazoProducao).trim() ? String(body.prazoProducao).trim().slice(0, 200) : null,
        criadoPor: (session.user as any)?.name || (session.user as any)?.email || null,
      },
    });
    return NextResponse.json(criado, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
