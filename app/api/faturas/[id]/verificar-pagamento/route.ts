export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { consultarEstadoMBWay, listarPagamentosIfThenPay } from '@/lib/grafica/ifthenpay-consultas';
import { registarPagamentoConfirmado } from '@/lib/faturas/registar-pagamento';

// Verificação on-demand do pagamento de UMA fatura de cliente junto do IfThenPay.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fatura = await prisma.fatura.findUnique({ where: { id: params?.id } });
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

    if (fatura.pagamentoValidado) {
      return NextResponse.json({ ok: true, paga: true, jaEstavaPaga: true, message: 'Fatura já se encontra paga.' });
    }

    const valorFatura = Number(fatura.valor ?? 0);
    const f: any = fatura;

    // 1) MB WAY — consulta directa por requestId (não requer chave de backoffice)
    if (f.mbwayRequestId) {
      const estado = await consultarEstadoMBWay(f.mbwayRequestId);
      if (estado?.paga) {
        await registarPagamentoConfirmado(fatura, {
          metodo: 'mbway',
          valorPago: estado.amount || valorFatura,
          dataPagamento: estado.dataPagamento || new Date(),
          requestId: f.mbwayRequestId,
        });
        return NextResponse.json({ ok: true, paga: true, metodo: 'mbway', message: 'Pagamento MB WAY confirmado. Fatura marcada como paga e comprovativo gerado.' });
      }
      // Atualizar estado local (expirado/recusado) para refletir na UI
      if (estado && !estado.paga && ['expired', 'declined', 'rejected', 'rejected_by_user'].includes(estado.status)) {
        try { await prisma.fatura.update({ where: { id: fatura.id }, data: { mbwayEstado: 'expirado' } as any }); } catch { /* noop */ }
      }
    }

    // 2) Lista de pagamentos (Multibanco e/ou confirmação adicional). Requer chave de backoffice.
    const referenciasAlvo = [f.mbReferencia, f.mbwayOrderId, f.mbOrderId].filter(Boolean).map(String);
    if (referenciasAlvo.length > 0) {
      const desde = f.mbGeradoEm || f.mbwayIniciadoEm || new Date(Date.now() - 1000 * 60 * 60 * 24 * 120);
      const lista = await listarPagamentosIfThenPay({ desde: new Date(desde) });
      if (!lista.disponivel) {
        // Sem chave de backoffice: se for Multibanco não conseguimos confirmar automaticamente.
        if (f.mbwayRequestId) {
          return NextResponse.json({ ok: true, paga: false, message: 'Ainda sem confirmação de pagamento MB WAY.' });
        }
        return NextResponse.json({ ok: false, semChave: true, message: 'Para verificar pagamentos Multibanco é necessário configurar a chave de backoffice IfThenPay.' }, { status: 400 });
      }
      const match = lista.pagamentos.find((p) => referenciasAlvo.includes(p.referencia) || referenciasAlvo.includes(p.id));
      if (match) {
        const ehMbway = !!f.mbwayOrderId && (match.referencia === f.mbwayOrderId || match.id === f.mbwayOrderId);
        await registarPagamentoConfirmado(fatura, {
          metodo: ehMbway ? 'mbway' : 'multibanco',
          valorPago: match.valor || valorFatura,
          dataPagamento: match.dataPagamento || new Date(),
          entity: ehMbway ? null : (match.entidade || f.mbEntidade),
          reference: ehMbway ? null : (match.referencia || f.mbReferencia),
        });
        return NextResponse.json({ ok: true, paga: true, metodo: ehMbway ? 'mbway' : 'multibanco', message: 'Pagamento confirmado no IfThenPay. Fatura marcada como paga e comprovativo gerado.' });
      }
    }

    return NextResponse.json({ ok: true, paga: false, message: 'Ainda não consta nenhum pagamento para esta fatura no IfThenPay.' });
  } catch (error: any) {
    console.error('[faturas/verificar-pagamento] erro:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao verificar pagamento' }, { status: 500 });
  }
}
