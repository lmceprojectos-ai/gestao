export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { tipoTemIva } from '@/lib/grafica/numero';

const ESTADOS_ORDEM = ['rascunho', 'pendente', 'em_analise', 'adjudicado', 'producao', 'finalizado', 'recusado'];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const anoParam = (searchParams.get('ano') || '').trim();

    const where: any = {};
    if (anoParam && /^\d{4}$/.test(anoParam)) {
      const ano = Number(anoParam);
      where.createdAt = {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lt: new Date(Date.UTC(ano + 1, 0, 1)),
      };
    }

    const orcamentos = await prisma.orcamentoGrafico.findMany({
      where,
      select: {
        tipoOrcamento: true,
        produto: true,
        estado: true,
        quantidade: true,
        precoSemIva: true,
        precoComIva: true,
        custoTotal: true,
        createdAt: true,
      },
    });

    // Anos disponíveis (para o seletor)
    const anosSet = new Set<number>();
    const todosParaAnos = await prisma.orcamentoGrafico.findMany({ select: { createdAt: true } });
    for (const o of todosParaAnos) {
      anosSet.add(new Date(o.createdAt).getUTCFullYear());
    }
    const anos = Array.from(anosSet).sort((a, b) => b - a);

    // Totais globais.
    // ONF (isento de IVA) é contabilizado à parte: o seu valor NÃO é somado ao total c/IVA,
    // porque não tem imposto e não pode ser misturado com os orçamentos tributados (OC/OL).
    let totalCount = 0;
    let totalSemIva = 0;      // base líquida de todos os tipos
    let totalCusto = 0;       // custo de todos os tipos
    // Só orçamentos COM IVA (OC/OL)
    let ivaCount = 0;
    let ivaSemIva = 0;
    let ivaComIva = 0;
    // Só orçamentos ONF (isentos de IVA)
    let onfCount = 0;
    let onfSemIva = 0;

    const porTipoMap: Record<string, { tipo: string; temIva: boolean; count: number; semIva: number; comIva: number }> = {};
    const porEstadoMap: Record<string, { estado: string; count: number; semIva: number; comIvaTributavel: number }> = {};
    const porProdutoMap: Record<string, { produto: string; count: number; semIva: number }> = {};

    for (const o of orcamentos) {
      const semIva = o.precoSemIva || 0;
      const comIva = o.precoComIva || 0;
      const custo = o.custoTotal || 0;
      const tipo = (o.tipoOrcamento || 'OC').toUpperCase();
      const temIva = tipoTemIva(tipo);

      totalCount += 1;
      totalSemIva += semIva;
      totalCusto += custo;

      if (temIva) {
        ivaCount += 1;
        ivaSemIva += semIva;
        ivaComIva += comIva;
      } else {
        onfCount += 1;
        onfSemIva += semIva;
      }

      if (!porTipoMap[tipo]) porTipoMap[tipo] = { tipo, temIva, count: 0, semIva: 0, comIva: 0 };
      porTipoMap[tipo].count += 1;
      porTipoMap[tipo].semIva += semIva;
      porTipoMap[tipo].comIva += comIva;

      const estado = o.estado || 'pendente';
      if (!porEstadoMap[estado]) porEstadoMap[estado] = { estado, count: 0, semIva: 0, comIvaTributavel: 0 };
      porEstadoMap[estado].count += 1;
      porEstadoMap[estado].semIva += semIva;
      if (temIva) porEstadoMap[estado].comIvaTributavel += comIva;

      const produto = o.produto || 'cartoes';
      if (!porProdutoMap[produto]) porProdutoMap[produto] = { produto, count: 0, semIva: 0 };
      porProdutoMap[produto].count += 1;
      porProdutoMap[produto].semIva += semIva;
    }

    const porTipo = Object.values(porTipoMap).sort((a, b) => b.semIva - a.semIva);
    const porEstado = Object.values(porEstadoMap).sort(
      (a, b) => ESTADOS_ORDEM.indexOf(a.estado) - ESTADOS_ORDEM.indexOf(b.estado)
    );
    const porProduto = Object.values(porProdutoMap).sort((a, b) => b.semIva - a.semIva);

    // Valores por estado de recebimento (adjudicado = a receber/ganho)
    const adjudicado = porEstadoMap['adjudicado'] || { count: 0, semIva: 0, comIvaTributavel: 0 };
    const pendente = porEstadoMap['pendente'] || { count: 0, semIva: 0, comIvaTributavel: 0 };
    const recusado = porEstadoMap['recusado'] || { count: 0, semIva: 0, comIvaTributavel: 0 };

    // Taxa de adjudicação (sobre orçamentos com decisão: adjudicado + recusado)
    const decididos = adjudicado.count + recusado.count;
    const taxaAdjudicacao = decididos > 0 ? adjudicado.count / decididos : 0;

    const margemGlobal = totalSemIva > 0 ? (totalSemIva - totalCusto) / totalSemIva : 0;

    return NextResponse.json({
      ano: anoParam && /^\d{4}$/.test(anoParam) ? Number(anoParam) : null,
      anosDisponiveis: anos,
      totais: {
        count: totalCount,
        semIva: totalSemIva,
        custo: totalCusto,
        margem: margemGlobal,
        // Orçamentos com IVA (OC/OL)
        ivaCount,
        ivaSemIva,
        ivaComIva,
        // Orçamentos ONF (isentos de IVA) — apresentados à parte
        onfCount,
        onfSemIva,
      },
      recebimento: {
        adjudicadoCount: adjudicado.count,
        adjudicadoSemIva: adjudicado.semIva,
        adjudicadoComIvaTributavel: adjudicado.comIvaTributavel,
        pendenteCount: pendente.count,
        pendenteSemIva: pendente.semIva,
        recusadoCount: recusado.count,
        recusadoSemIva: recusado.semIva,
        taxaAdjudicacao,
      },
      porTipo,
      porEstado,
      porProduto,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
