export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get('periodo') ?? '6';
    const meses = parseInt(periodo);

    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - meses);

    const [recebimentos, pagamentos, contas, despesas, faturas] = await Promise.all([
      prisma.recebimento.findMany({
        where: { dataRecebimento: { gte: dataInicio } },
        orderBy: { dataRecebimento: 'asc' },
        select: { valor: true, estado: true, dataRecebimento: true, descricao: true },
      }),
      prisma.pagamento.findMany({
        where: { dataPagamento: { gte: dataInicio } },
        orderBy: { dataPagamento: 'asc' },
        select: { valor: true, estado: true, dataPagamento: true, descricao: true },
      }),
      prisma.contaBancaria.findMany({ where: { ativa: true } }),
      prisma.despesa.findMany({
        where: { data: { gte: dataInicio } },
        orderBy: { data: 'asc' },
        select: { valor: true, data: true, categoria: true, subcategoria: true, estado: true },
      }),
      prisma.fatura.findMany({
        where: { dataEmissao: { gte: dataInicio }, tipo: 'emitida', estado: { not: 'anulado' } },
        orderBy: { dataEmissao: 'asc' },
        select: { valor: true, dataEmissao: true },
      }),
    ]);

    // Agrupar por mês
    const monthlyData: Record<string, { recebimentos: number; pagamentos: number }> = {};
    
    (recebimentos ?? []).forEach((r: any) => {
      const key = `${new Date(r?.dataRecebimento).getFullYear()}-${String(new Date(r?.dataRecebimento).getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { recebimentos: 0, pagamentos: 0 };
      monthlyData[key].recebimentos += r?.valor ?? 0;
    });

    (pagamentos ?? []).forEach((p: any) => {
      const key = `${new Date(p?.dataPagamento).getFullYear()}-${String(new Date(p?.dataPagamento).getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { recebimentos: 0, pagamentos: 0 };
      monthlyData[key].pagamentos += p?.valor ?? 0;
    });

    const fluxoCaixa = Object.keys(monthlyData ?? {})
      .sort()
      .map((key: string) => ({
        mes: key,
        recebimentos: monthlyData[key]?.recebimentos ?? 0,
        pagamentos: monthlyData[key]?.pagamentos ?? 0,
        saldo: (monthlyData[key]?.recebimentos ?? 0) - (monthlyData[key]?.pagamentos ?? 0),
      }));

    const totalRecebimentos = (recebimentos ?? []).reduce((a: number, r: any) => a + (r?.valor ?? 0), 0);
    const totalPagamentos = (pagamentos ?? []).reduce((a: number, p: any) => a + (p?.valor ?? 0), 0);

    // Despesas mensais vs Faturação mensal
    const despesasVsFaturacao: Record<string, { despesas: number; faturacao: number }> = {};
    (despesas ?? []).forEach((d: any) => {
      const key = `${new Date(d.data).getFullYear()}-${String(new Date(d.data).getMonth() + 1).padStart(2, '0')}`;
      if (!despesasVsFaturacao[key]) despesasVsFaturacao[key] = { despesas: 0, faturacao: 0 };
      despesasVsFaturacao[key].despesas += d.valor ?? 0;
    });
    (faturas ?? []).forEach((f: any) => {
      if (!f.dataEmissao) return;
      const key = `${new Date(f.dataEmissao).getFullYear()}-${String(new Date(f.dataEmissao).getMonth() + 1).padStart(2, '0')}`;
      if (!despesasVsFaturacao[key]) despesasVsFaturacao[key] = { despesas: 0, faturacao: 0 };
      despesasVsFaturacao[key].faturacao += f.valor ?? 0;
    });
    const comparativoMensal = Object.keys(despesasVsFaturacao).sort().map(key => ({
      mes: key,
      despesas: despesasVsFaturacao[key].despesas,
      faturacao: despesasVsFaturacao[key].faturacao,
      margem: despesasVsFaturacao[key].faturacao - despesasVsFaturacao[key].despesas,
    }));

    // Despesas por categoria (do período)
    const despesasPorCategoria: Record<string, number> = {};
    (despesas ?? []).forEach((d: any) => {
      const cat = d.categoria || 'outro';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + (d.valor || 0);
    });

    return NextResponse.json({
      fluxoCaixa,
      totalRecebimentos,
      totalPagamentos,
      saldoContas: (contas ?? []).reduce((a: number, c: any) => a + (c?.saldoAtual ?? 0), 0),
      contas: contas ?? [],
      comparativoMensal,
      despesasPorCategoria,
      totalDespesas: (despesas ?? []).reduce((a: number, d: any) => a + (d.valor || 0), 0),
      totalFaturacao: (faturas ?? []).reduce((a: number, f: any) => a + (f.valor || 0), 0),
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
