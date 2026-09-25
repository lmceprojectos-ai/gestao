export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Recalcula o saldo atual de cada conta bancária a partir do saldo inicial:
//   saldoAtual = saldoInicial
//     + recebimentos pagos/recebidos associados à conta
//     - pagamentos pagos associados à conta
//     - despesas pagas associadas à conta
//     + transferências recebidas (conta destino)
//     - transferências enviadas (conta origem)
//
// Se a conta tiver "dataSaldoInicial" definida, o saldo inicial é interpretado
// como o saldo real do banco NESSA data, pelo que apenas os movimentos
// posteriores a essa data (estritamente > dataSaldoInicial) são somados.
// Assim, o histórico anterior à data de referência não altera o saldo.
//
// Se a conta tiver movimentos bancários importados dos extratos (posteriores à
// data de referência), são eles a fonte do saldo, porque refletem o banco:
//   saldoAtual = saldoInicial + créditos - débitos dos movimentos bancários
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const contas = await prisma.contaBancaria.findMany();
    const resultados: { id: string; nome: string; saldoAnterior: number; saldoNovo: number }[] = [];

    for (const conta of contas) {
      const ref = conta.dataSaldoInicial ?? null;

      // Filtros de data condicionais (apenas quando existe data de referência).
      const recWhere: any = { estado: { in: ['pago', 'recebido'] }, contaBancariaId: conta.id };
      const pagWhere: any = { estado: 'pago', contaBancariaId: conta.id };
      const despWhere: any = { estado: 'pago', contaBancariaId: conta.id };
      const transfInWhere: any = { contaDestinoId: conta.id };
      const transfOutWhere: any = { contaOrigemId: conta.id };

      if (ref) {
        recWhere.dataRecebimento = { gt: ref };
        pagWhere.dataPagamento = { gt: ref };
        despWhere.data = { gt: ref };
        transfInWhere.data = { gt: ref };
        transfOutWhere.data = { gt: ref };
      }

      const [rec, pag, desp, transfIn, transfOut] = await Promise.all([
        prisma.recebimento.aggregate({ _sum: { valor: true }, where: recWhere }),
        prisma.pagamento.aggregate({ _sum: { valor: true }, where: pagWhere }),
        prisma.despesa.aggregate({ _sum: { valor: true }, where: despWhere }),
        prisma.transferenciaInterna.aggregate({ _sum: { valor: true }, where: transfInWhere }),
        prisma.transferenciaInterna.aggregate({ _sum: { valor: true }, where: transfOutWhere }),
      ]);

      const movWhere: any = { contaBancariaId: conta.id };
      if (ref) movWhere.dataMovimento = { gt: ref };
      const movs = await prisma.movimentoBancario.findMany({ where: movWhere, select: { valor: true, tipo: true } });

      const saldoNovo = movs.length > 0
        ? (conta.saldoInicial ?? 0) +
          movs.reduce((t, m) => t + (m.tipo === 'debito' ? -Math.abs(m.valor) : Math.abs(m.valor)), 0)
        : (conta.saldoInicial ?? 0) +
        (rec._sum.valor ?? 0) -
        (pag._sum.valor ?? 0) -
        (desp._sum.valor ?? 0) +
        (transfIn._sum.valor ?? 0) -
        (transfOut._sum.valor ?? 0);

      const saldoNovoArredondado = Math.round(saldoNovo * 100) / 100;

      await prisma.contaBancaria.update({
        where: { id: conta.id },
        data: { saldoAtual: saldoNovoArredondado },
      });

      resultados.push({
        id: conta.id,
        nome: conta.nome,
        saldoAnterior: conta.saldoAtual ?? 0,
        saldoNovo: saldoNovoArredondado,
      });
    }

    return NextResponse.json({ ok: true, contas: resultados });
  } catch (error: any) {
    console.error('Erro ao recalcular saldos:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao recalcular saldos' }, { status: 500 });
  }
}
