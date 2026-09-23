export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getMoloniCompanyId,
  getMoloniDocumentSets,
  getMoloniTaxes,
  createMoloniCustomer,
  createMoloniDraftInvoice,
} from '@/lib/moloni';
import { carregarConfigGrafica } from '@/lib/grafica/load-config';
import { descricaoItemGrafica } from '@/lib/grafica/pdf-template';

function eurTxt(n: number): string {
  return `${(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const orc = await prisma.orcamentoGrafico.findUnique({ where: { id: params.id } });
    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    if (orc.tipoOrcamento === 'ONF') {
      return NextResponse.json(
        { error: 'Orçamentos não faturados (ONF) servem apenas para controlo interno e não podem ser faturados.' },
        { status: 400 }
      );
    }

    if (!orc.clienteId) {
      return NextResponse.json(
        { error: 'Associe um cliente ao orçamento antes de emitir a fatura rascunho.' },
        { status: 400 }
      );
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: orc.clienteId } });
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });

    const config = await carregarConfigGrafica();
    const companyId = await getMoloniCompanyId();

    // 1) Garantir cliente no Moloni
    let moloniCustomerId = cliente.moloniId;
    if (!moloniCustomerId) {
      const novoCliente = await createMoloniCustomer(companyId, {
        name: cliente.nome,
        vat: cliente.nif || '999999990',
        email: cliente.email || undefined,
        phone: cliente.telefone || undefined,
        address: cliente.morada || undefined,
      });
      if (!novoCliente?.customer_id) {
        return NextResponse.json({ error: 'Não foi possível criar o cliente no Moloni.' }, { status: 502 });
      }
      moloniCustomerId = novoCliente.customer_id;
      await prisma.cliente.update({ where: { id: cliente.id }, data: { moloniId: moloniCustomerId } });
    }

    // 2) Document set
    const documentSets = await getMoloniDocumentSets(companyId);
    if (!Array.isArray(documentSets) || documentSets.length === 0) {
      return NextResponse.json(
        { error: 'Não existem séries de documentos configuradas no Moloni.' },
        { status: 502 }
      );
    }
    const documentSetId = documentSets[0].document_set_id;

    // 3) Imposto IVA correspondente
    let taxId: number | undefined;
    try {
      const taxes = await getMoloniTaxes(companyId);
      if (Array.isArray(taxes)) {
        const ivaPct = Math.round(config.iva * 100);
        const match = taxes.find((t: any) => Math.round(Number(t.value)) === ivaPct) || taxes[0];
        if (match) taxId = match.tax_id;
      }
    } catch {
      // segue sem imposto explícito
    }

    // Linhas: uma por produto (multi-produto) ou uma única linha (legado).
    const itensArr: any[] = Array.isArray(orc.itens) && (orc.itens as any[]).length
      ? (orc.itens as any[])
      : [{
          produto: orc.produto,
          especificacoes: orc.especificacoes,
          quantidade: orc.quantidade,
          precoSemIva: orc.precoSemIva,
          breakdown: orc.breakdown,
          arteFinalModo: orc.arteFinalModo,
          arteFinalValor: orc.arteFinalValor,
        }];

    // --- Linhas de produto (preço BRUTO s/IVA, sem desconto/sobretaxa) ---
    // Cada condição de venda entra como linha própria, para o total ficar todo em contas.
    // precoSemIva do item = base × (1 - desconto) × (1 + sobretaxa 24H)
    let brutoBase = 0, descontoValor = 0, sobretaxaValor = 0;
    const products: any[] = itensArr.map((it: any) => {
      const bd = it.breakdown || {};
      const dc = Number(bd.descontoCliente) || 0;
      const st = Number(bd.sobretaxa24h) || 0;
      const psi = Number(it.precoSemIva) || 0;
      const fatorDesc = dc > 0 && dc < 1 ? (1 - dc) : 1;
      const base = fatorDesc * (1 + st) > 0 ? psi / (fatorDesc * (1 + st)) : psi;
      brutoBase += base;
      descontoValor += dc > 0 && dc < 1 ? base * dc : 0;
      sobretaxaValor += st > 0 ? base * fatorDesc * st : 0;
      const qtd = Number(it.quantidade) || 0;
      const unit = qtd > 0 ? base / qtd : base;
      // O Moloni não aceita linhas com preço negativo, por isso o desconto de
      // cliente entra no campo de desconto nativo da linha (percentagem).
      const descLinhaPct = dc > 0 && dc < 1 ? dc * 100 : 0;
      return {
        name: descricaoItemGrafica(it.produto, it.especificacoes || {}, config),
        qty: qtd > 0 ? qtd : 1,
        price: unit,
        discount: descLinhaPct > 0 ? descLinhaPct : undefined,
        taxId,
        exemptionReason: taxId ? undefined : 'M00',
      };
    });

    // --- Condições de venda como linhas próprias ---
    const descCfg = config.descontosCliente.find((dd: any) => dd.tipo === orc.tipoCliente);
    const descLabel = descCfg?.label || 'Cliente';
    const descPct = orc.descontoManual != null ? Number(orc.descontoManual) : (descCfg?.desconto || 0);

    // Produção urgente 24H (acréscimo)
    if (sobretaxaValor > 0) {
      products.push({ name: 'Produção urgente 24H', qty: 1, price: sobretaxaValor, taxId, exemptionReason: taxId ? undefined : 'M00' });
    }
    // Arte-final
    const arteTotal = itensArr.reduce((s: number, it: any) => s + (Number(it.arteFinalValor) > 0 ? Number(it.arteFinalValor) : 0), 0);
    if (arteTotal > 0) {
      products.push({ name: 'Arte-final', qty: 1, price: arteTotal, taxId, exemptionReason: taxId ? undefined : 'M00' });
    }
    // Portes de envio
    const portes = orc.portesEnvio && orc.portesEnvio > 0 ? orc.portesEnvio : 0;
    const portesLabel = orc.tipoPortes === 'envio24h' ? 'Portes de envio 24H'
      : orc.tipoPortes === 'envio' ? 'Portes de envio'
      : 'Portes';
    if (portes > 0) {
      products.push({ name: portesLabel, qty: 1, price: portes, taxId, exemptionReason: taxId ? undefined : 'M00' });
    }
    // Opções extra incluídas
    const opcoesArr: any[] = Array.isArray(orc.opcoesExtra) ? (orc.opcoesExtra as any[]) : [];
    const opcoesIncluidas = opcoesArr.filter((o) => o?.incluida && Number(o?.valor) > 0);
    for (const o of opcoesIncluidas) {
      products.push({ name: o.descricao || 'Opção', qty: 1, price: Number(o.valor) || 0, taxId, exemptionReason: taxId ? undefined : 'M00' });
    }

    const linhasObs: string[] = [];
    linhasObs.push('Condições de venda:');
    if (sobretaxaValor > 0) linhasObs.push(`• Produção urgente 24H: +${eurTxt(sobretaxaValor)}`);
    if (descontoValor > 0) linhasObs.push(`• Desconto ${descLabel} (${Math.round(descPct * 100)}%): -${eurTxt(descontoValor)}`);
    if (arteTotal > 0) linhasObs.push(`• Arte-final: +${eurTxt(arteTotal)}`);
    for (const o of opcoesIncluidas) linhasObs.push(`• ${o.descricao || 'Opção'}: +${eurTxt(Number(o.valor) || 0)}`);
    if (portes > 0) linhasObs.push(`• ${portesLabel}: +${eurTxt(portes)}`);
    const observacoes = [linhasObs.join('\n'), (orc.notas || '').trim()].filter(Boolean).join('\n\n');

    // 4) Criar fatura rascunho
    const resultado = await createMoloniDraftInvoice(companyId, {
      customerId: moloniCustomerId!,
      documentSetId,
      products,
      notes: observacoes,
      ourReference: `ORC-${orc.numero}`,
    });

    const docId = resultado?.document_id;
    if (!docId || resultado?.valid !== 1) {
      // O Moloni devolve, p.ex., ["1 products"] quando uma linha é inválida.
      const detalhe = Array.isArray(resultado)
        ? resultado.join(', ')
        : (resultado?.errors ? JSON.stringify(resultado.errors) : JSON.stringify(resultado));
      return NextResponse.json(
        { error: `O Moloni rejeitou a fatura rascunho: ${detalhe}` },
        { status: 502 }
      );
    }

    await prisma.orcamentoGrafico.update({
      where: { id: orc.id },
      data: { moloniDocId: String(docId) },
    });

    return NextResponse.json({ success: true, document_id: docId, resultado });
  } catch (error: any) {
    console.error('Moloni draft invoice error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao emitir fatura rascunho no Moloni' },
      { status: 500 }
    );
  }
}