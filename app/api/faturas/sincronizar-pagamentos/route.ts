export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { consultarEstadoMBWay, listarPagamentosIfThenPay } from '@/lib/ifthenpay/consultas';
import { registarPagamentoConfirmado } from '@/lib/faturas/registar-pagamento';

// Sincronização global: vai ao IfThenPay buscar pagamentos e marca as faturas de clientes
// correspondentes como pagas (gerando comprovativo e recebimento).
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Faturas de clientes por pagar com método IfThenPay associado.
    const pendentes = await prisma.fatura.findMany({
      where: {
        tipo: 'emitida',
        origem: 'cliente',
        pagamentoValidado: false,
        OR: [
          { mbReferencia: { not: null } },
          { mbwayOrderId: { not: null } },
          { mbOrderId: { not: null } },
        ],
      } as any,
    });

    if (pendentes.length === 0) {
      return NextResponse.json({ ok: true, confirmadas: 0, verificadas: 0, message: 'Não existem faturas por confirmar com pagamento IfThenPay associado.' });
    }

    const confirmadas: string[] = [];
    let semChave = false;

    // 1) Lista de pagamentos (uma só chamada) — cobre Multibanco e MB WAY. Requer chave de backoffice.
    const desdeCandidatos = pendentes
      .map((f: any) => f.mbGeradoEm || f.mbwayIniciadoEm)
      .filter(Boolean)
      .map((d: any) => new Date(d).getTime());
    const desde = desdeCandidatos.length > 0
      ? new Date(Math.min(...desdeCandidatos) - 1000 * 60 * 60 * 24) // um dia antes do mais antigo
      : new Date(Date.now() - 1000 * 60 * 60 * 24 * 180);

    const lista = await listarPagamentosIfThenPay({ desde });
    const jaConfirmadas = new Set<string>();

    if (lista.disponivel && lista.pagamentos.length > 0) {
      for (const f of pendentes as any[]) {
        const alvos = [f.mbReferencia, f.mbwayOrderId, f.mbOrderId].filter(Boolean).map(String);
        if (alvos.length === 0) continue;
        const match = lista.pagamentos.find((p) => alvos.includes(p.referencia) || alvos.includes(p.id));
        if (match) {
          const ehMbway = !!f.mbwayOrderId && (match.referencia === f.mbwayOrderId || match.id === f.mbwayOrderId);
          await registarPagamentoConfirmado(f, {
            metodo: ehMbway ? 'mbway' : 'multibanco',
            valorPago: match.valor || Number(f.valor ?? 0),
            dataPagamento: match.dataPagamento || new Date(),
            entity: ehMbway ? null : (match.entidade || f.mbEntidade),
            reference: ehMbway ? null : (match.referencia || f.mbReferencia),
          });
          confirmadas.push(f.numero || f.id);
          jaConfirmadas.add(f.id);
        }
      }
    } else if (!lista.disponivel) {
      semChave = true;
    }

    // 2) MB WAY por requestId (não requer chave de backoffice) — para as que ainda não confirmaram.
    const mbwayPendentes = (pendentes as any[]).filter((f) => f.mbwayRequestId && !jaConfirmadas.has(f.id)).slice(0, 40);
    for (const f of mbwayPendentes) {
      const estado = await consultarEstadoMBWay(f.mbwayRequestId);
      if (estado?.paga) {
        await registarPagamentoConfirmado(f, {
          metodo: 'mbway',
          valorPago: estado.amount || Number(f.valor ?? 0),
          dataPagamento: estado.dataPagamento || new Date(),
          requestId: f.mbwayRequestId,
        });
        confirmadas.push(f.numero || f.id);
        jaConfirmadas.add(f.id);
      } else if (estado && ['expired', 'declined', 'rejected', 'rejected_by_user'].includes(estado.status)) {
        try { await prisma.fatura.update({ where: { id: f.id }, data: { mbwayEstado: 'expirado' } as any }); } catch { /* noop */ }
      }
    }

    let message: string;
    if (confirmadas.length > 0) {
      message = `${confirmadas.length} fatura(s) confirmada(s) como paga(s): ${confirmadas.join(', ')}.`;
    } else if (semChave) {
      message = 'Nenhuma confirmação MB WAY encontrada. Para sincronizar também os pagamentos Multibanco, configure a chave de backoffice IfThenPay.';
    } else {
      message = 'Nenhum novo pagamento encontrado no IfThenPay.';
    }

    return NextResponse.json({
      ok: true,
      confirmadas: confirmadas.length,
      verificadas: pendentes.length,
      semChaveBackoffice: semChave,
      faturas: confirmadas,
      message,
    });
  } catch (error: any) {
    console.error('[faturas/sincronizar-pagamentos] erro:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao sincronizar pagamentos' }, { status: 500 });
  }
}
