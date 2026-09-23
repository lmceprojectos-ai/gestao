export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Duplica um orçamento gráfico existente criando um novo registo (rascunho)
// com um novo número sequencial. O original fica intacto.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const orig = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orig) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    const tipoOrcamento = orig.tipoOrcamento;
    const agg = await prisma.orcamentoGrafico.aggregate({
      where: { tipoOrcamento },
      _max: { numeroTipo: true },
    });
    const numeroTipo = (agg._max.numeroTipo || 0) + 1;

    const criado = await prisma.orcamentoGrafico.create({
      data: {
        tipoOrcamento,
        numeroTipo,
        clienteId: orig.clienteId,
        clienteNome: orig.clienteNome,
        clienteEmpresa: orig.clienteEmpresa,
        clienteContacto: orig.clienteContacto,
        clienteNif: orig.clienteNif,
        clienteEmail: orig.clienteEmail,
        clienteTelefone: orig.clienteTelefone,
        clienteMorada: orig.clienteMorada,
        clienteCodigoPostal: orig.clienteCodigoPostal,
        clienteCidade: orig.clienteCidade,
        produto: orig.produto,
        especificacoes: orig.especificacoes as any,
        acabamentos: orig.acabamentos as any,
        quantidade: orig.quantidade,
        tipoCliente: orig.tipoCliente,
        entrega24h: orig.entrega24h,
        descontoManual: orig.descontoManual,
        tipoPortes: orig.tipoPortes,
        portesEnvio: orig.portesEnvio,
        arteFinalModo: orig.arteFinalModo,
        arteFinalValor: orig.arteFinalValor,
        arteFinalFicheiro: orig.arteFinalFicheiro,
        arteFinalNome: orig.arteFinalNome,
        opcoesExtra: orig.opcoesExtra as any,
        deslocacao: orig.deslocacao as any,
        prazoProducao: orig.prazoProducao,
        custoTotal: orig.custoTotal,
        margem: orig.margem,
        precoSemIva: orig.precoSemIva,
        precoComIva: orig.precoComIva,
        precoUnitario: orig.precoUnitario,
        breakdown: orig.breakdown as any,
        tabelaPrecos: orig.tabelaPrecos as any,
        itens: orig.itens as any,
        estado: 'rascunho',
        notas: orig.notas,
        criadoPor: (session.user as any)?.name || (session.user as any)?.email || null,
      },
    });
    return NextResponse.json(criado, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
