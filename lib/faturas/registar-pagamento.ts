// Registo de um pagamento confirmado numa fatura de cliente.
// Partilhado pelo callback IfThenPay e pela verificação/sincronização on-demand.
// Idempotente: se a fatura já estiver paga, não reprocessa.

import { prisma } from '@/lib/db';
import { uploadBufferToS3 } from '@/lib/s3';
import { gerarComprovativoPdf } from '@/lib/faturas/comprovativo';

export interface RegistarPagamentoArgs {
  metodo: 'multibanco' | 'mbway';
  valorPago: number;
  dataPagamento: Date;
  entity?: string | null;
  reference?: string | null;
  requestId?: string | null;
}

export interface RegistarPagamentoResultado {
  ok: boolean;
  jaEstavaPaga: boolean;
}

/**
 * Marca a fatura como paga, gera/anexa o comprovativo PDF e cria o recebimento.
 * `fatura` deve ser um registo já obtido da base de dados.
 */
export async function registarPagamentoConfirmado(
  fatura: any,
  args: RegistarPagamentoArgs,
): Promise<RegistarPagamentoResultado> {
  if (!fatura) return { ok: false, jaEstavaPaga: false };

  // Idempotência
  if (fatura.pagamentoValidado) {
    return { ok: true, jaEstavaPaga: true };
  }

  const { metodo, valorPago, dataPagamento } = args;
  const entity = args.entity ?? null;
  const reference = args.reference ?? null;
  const requestId = args.requestId ?? null;

  // 1) Marcar como paga
  await prisma.fatura.update({
    where: { id: fatura.id },
    data: {
      pagamentoValidado: true,
      formaPagamento: metodo,
      dataPagamento,
      dataValidacaoPagamento: new Date(),
      validadoPor: metodo === 'mbway' ? 'IfThenPay (MB WAY)' : 'IfThenPay (Multibanco)',
      estado: 'paga',
      ...(metodo === 'mbway'
        ? {
            mbwayEstado: 'pago',
            mbwayRequestId: requestId || fatura.mbwayRequestId || null,
          }
        : {
            mbPagamentoData: dataPagamento,
            mbRequestId: requestId || fatura.mbRequestId || null,
            mbEntidade: entity || fatura.mbEntidade || null,
            mbReferencia: reference || fatura.mbReferencia || null,
          }),
    } as any,
  });

  // 2) Gerar comprovativo PDF e anexar
  try {
    const clienteNome = fatura.clienteId
      ? (await prisma.cliente.findUnique({ where: { id: fatura.clienteId }, select: { nome: true } }))?.nome
      : fatura.entidadeNome;
    const pdf = await gerarComprovativoPdf({
      numeroFatura: fatura.numero,
      descricao: fatura.descricao,
      clienteNome: clienteNome || fatura.entidadeNome,
      clienteNif: fatura.entidadeNif,
      metodo: metodo === 'mbway' ? 'MB WAY (IfThenPay)' : 'Multibanco (IfThenPay)',
      entidade: metodo === 'mbway' ? null : (entity || fatura.mbEntidade),
      referencia: metodo === 'mbway' ? null : (reference || fatura.mbReferencia),
      telemovel: metodo === 'mbway' ? fatura.mbwayTelemovel : null,
      valor: valorPago,
      dataPagamento,
    });
    if (pdf) {
      const nome = `comprovativo-${fatura.numero || fatura.id}.pdf`;
      const { cloud_storage_path } = await uploadBufferToS3(pdf, nome, 'application/pdf', false);
      await prisma.fatura.update({
        where: { id: fatura.id },
        data: {
          comprovativoPath: cloud_storage_path,
          comprovativoContentType: 'application/pdf',
          comprovativoOriginal: nome,
        },
      });
    }
  } catch (e: any) {
    console.error('[registar-pagamento] Falha ao gerar/anexar comprovativo:', e?.message || e);
  }

  // 3) Registar recebimento
  try {
    await prisma.recebimento.create({
      data: {
        descricao: fatura.numero ? `Fatura ${fatura.numero}` : (fatura.descricao || 'Recebimento IfThenPay'),
        valor: valorPago,
        dataRecebimento: dataPagamento,
        estado: 'recebido',
        metodoPagamento: metodo,
        referencia: metodo === 'mbway'
          ? (requestId || fatura.mbwayRequestId || null)
          : (reference || fatura.mbReferencia || null),
        notas: metodo === 'mbway'
          ? `Pagamento MB WAY confirmado via IfThenPay${fatura.mbwayTelemovel ? ` (${fatura.mbwayTelemovel})` : ''}.`
          : `Pagamento Multibanco confirmado via IfThenPay${entity ? ` (Entidade ${entity})` : ''}.`,
        clienteId: fatura.clienteId,
        faturaId: fatura.id,
        criadoPor: 'IfThenPay',
      },
    });
  } catch (e: any) {
    console.error('[registar-pagamento] Falha ao criar recebimento:', e?.message || e);
  }

  return { ok: true, jaEstavaPaga: false };
}
