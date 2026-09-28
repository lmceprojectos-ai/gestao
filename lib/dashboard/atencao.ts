// Dados do painel inicial: o que há a pagar e a receber (por data) e tudo o
// que precisa de ação na app. Os critérios de "fatura por pagar" são os mesmos
// do resto do dashboard (sem pagamento associado nem pagamento validado).
import { prisma } from '@/lib/db';
import { estadoMesEFatura, mesesEFatura } from '@/lib/efatura/estado';

export type ItemAgenda = {
  id: string;
  tipo: 'fatura' | 'imposto' | 'seguro' | 'vencimento' | 'pagamento' | 'recebimento';
  descricao: string;
  entidade: string | null;
  valor: number;
  data: string | null; // data de vencimento (ou de emissão, se não houver)
  vencido: boolean;
  href: string;
};

const INICIO_ANO = new Date('2026-01-01');
const DIAS_AVISO_IMPOSTOS = 15;

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export async function calcularAtencao() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteAviso = new Date(hoje.getTime() + DIAS_AVISO_IMPOSTOS * 86400000);
  const vencido = (d: Date | null | undefined) => !!d && d < hoje;

  const [faturas, impostos, seguros, vencimentos, pagamentos, recebimentos, digitalizacoes, movPorConciliar, faltasPonto, feriasPendentes] =
    await Promise.all([
      prisma.fatura.findMany({
        where: {
          estado: { not: 'anulado' },
          tipo: { in: ['emitida', 'recebida'] },
          pagamentoValidado: false,
          pagamentos: { none: {} },
          recebimentos: { none: {} },
          dataEmissao: { gte: INICIO_ANO },
        },
        select: {
          id: true, tipo: true, estado: true, numero: true, descricao: true, valor: true, valorReconciliado: true, moloniDocType: true,
          dataEmissao: true, dataVencimento: true, entidadeNome: true,
          cliente: { select: { nome: true } }, fornecedor: { select: { nome: true } },
        },
      }),
      prisma.imposto.findMany({ where: { estado: 'pendente' }, select: { id: true, tipo: true, descricao: true, valor: true, dataVencimento: true } }),
      prisma.seguro.findMany({ where: { estado: 'pendente' }, select: { id: true, tipo: true, seguradora: true, valor: true, dataVencimento: true, dataEmissao: true } }),
      prisma.vencimento.findMany({ where: { estado: 'pendente' }, select: { id: true, funcionario: true, periodo: true, valorLiquido: true, valorBruto: true, dataPagamento: true } }),
      prisma.pagamento.findMany({ where: { estado: 'pendente' }, select: { id: true, descricao: true, valor: true, dataPagamento: true, fornecedor: { select: { nome: true } } } }),
      prisma.recebimento.findMany({ where: { estado: 'pendente' }, select: { id: true, descricao: true, valor: true, dataRecebimento: true, cliente: { select: { nome: true } } } }),
      prisma.digitalizacaoImportada.groupBy({ by: ['estado'], _count: { _all: true }, where: { estado: { in: ['por_confirmar', 'erro'] } } }),
      prisma.movimentoBancario.count({ where: { reconciliado: false } }),
      prisma.absence.count({ where: { status: 'EM_ANALISE' } }),
      prisma.vacationRequest.count({ where: { status: 'PENDENTE' } }),
    ]);

  // Faturas-recibo e faturas já liquidadas no Moloni não estão por pagar.
  const porLiquidar = faturas.filter((f) => {
    if (f.tipo === 'emitida' && f.estado === 'rascunho') return false; // ainda não emitida no Moloni
    if (f.moloniDocType === 'invoiceReceipts') return false;
    if (f.valor != null && f.valorReconciliado != null && f.valorReconciliado >= f.valor - 0.01) return false;
    return (f.valor ?? 0) > 0;
  });

  const aPagar: ItemAgenda[] = [];
  const aReceber: ItemAgenda[] = [];

  for (const f of porLiquidar) {
    const data = f.dataVencimento ?? f.dataEmissao;
    const item: ItemAgenda = {
      id: f.id,
      tipo: 'fatura',
      descricao: f.numero || f.descricao || 'Fatura',
      entidade: f.tipo === 'emitida' ? f.cliente?.nome ?? f.entidadeNome : f.fornecedor?.nome ?? f.entidadeNome,
      valor: Math.round(Math.max(0, (f.valor ?? 0) - (f.valorReconciliado ?? 0)) * 100) / 100,
      data: iso(data),
      vencido: vencido(data),
      href: f.tipo === 'emitida' ? '/faturas?tipo=emitida&origem=cliente' : '/faturas?tipo=recebida&origem=fornecedor',
    };
    (f.tipo === 'emitida' ? aReceber : aPagar).push(item);
  }
  for (const i of impostos) {
    aPagar.push({ id: i.id, tipo: 'imposto', descricao: i.descricao || i.tipo, entidade: i.tipo, valor: i.valor, data: iso(i.dataVencimento), vencido: vencido(i.dataVencimento), href: '/impostos' });
  }
  for (const s of seguros) {
    const data = s.dataVencimento ?? s.dataEmissao;
    aPagar.push({ id: s.id, tipo: 'seguro', descricao: `Seguro ${s.tipo}`, entidade: s.seguradora, valor: s.valor, data: iso(data), vencido: vencido(data), href: '/seguros' });
  }
  for (const v of vencimentos) {
    aPagar.push({ id: v.id, tipo: 'vencimento', descricao: `Vencimento${v.periodo ? ` ${v.periodo}` : ''}`, entidade: v.funcionario, valor: v.valorLiquido ?? v.valorBruto, data: iso(v.dataPagamento), vencido: vencido(v.dataPagamento), href: '/vencimentos' });
  }
  for (const p of pagamentos) {
    aPagar.push({ id: p.id, tipo: 'pagamento', descricao: p.descricao, entidade: p.fornecedor?.nome ?? null, valor: p.valor, data: iso(p.dataPagamento), vencido: vencido(p.dataPagamento), href: '/pagamentos' });
  }
  for (const r of recebimentos) {
    aReceber.push({ id: r.id, tipo: 'recebimento', descricao: r.descricao, entidade: r.cliente?.nome ?? null, valor: r.valor, data: iso(r.dataRecebimento), vencido: vencido(r.dataRecebimento), href: '/recebimentos' });
  }

  // A mesma fatura digitalizada várias vezes conta uma só vez
  // (mesma entidade, mesmo número e mesmo valor).
  const semRepetidos = (lista: ItemAgenda[]) => {
    const vistos = new Set<string>();
    return lista.filter((i) => {
      if (i.tipo !== 'fatura') return true;
      const chave = `${(i.entidade || '').toLowerCase().slice(0, 12)}|${(i.descricao.match(/\d+/g) || []).join('.')}|${i.valor.toFixed(2)}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  };

  // Vencidos primeiro (os mais antigos no topo), depois por data.
  const ordenar = (a: ItemAgenda, b: ItemAgenda) => (a.data ?? '9999').localeCompare(b.data ?? '9999');
  const aPagarUnicos = semRepetidos(aPagar).sort(ordenar);
  const aReceberUnicos = semRepetidos(aReceber).sort(ordenar);
  const repetidos = aPagar.length - aPagarUnicos.length + (aReceber.length - aReceberUnicos.length);
  const soma = (l: ItemAgenda[]) => Math.round(l.reduce((s, i) => s + i.valor, 0) * 100) / 100;

  const impostosAVencer = impostos.filter((i) => i.dataVencimento && i.dataVencimento <= limiteAviso).length;

  // e-Fatura: documentos em falta no mês mais recente importado.
  let efatura: { mes: string; emFalta: number; valorEmFalta: number } | null = null;
  const meses = await mesesEFatura();
  if (meses[0]) {
    const { resumo } = await estadoMesEFatura(meses[0].mes);
    efatura = { mes: meses[0].mes, emFalta: resumo.emFalta, valorEmFalta: resumo.valorEmFalta };
  }

  const dig = Object.fromEntries(digitalizacoes.map((d) => [d.estado, d._count._all]));

  return {
    aPagar: {
      total: soma(aPagarUnicos),
      quantidade: aPagarUnicos.length,
      vencidos: aPagarUnicos.filter((i) => i.vencido).length,
      valorVencido: soma(aPagarUnicos.filter((i) => i.vencido)),
      itens: aPagarUnicos,
    },
    aReceber: {
      total: soma(aReceberUnicos),
      quantidade: aReceberUnicos.length,
      vencidos: aReceberUnicos.filter((i) => i.vencido).length,
      valorVencido: soma(aReceberUnicos.filter((i) => i.vencido)),
      itens: aReceberUnicos,
    },
    alertas: {
      digitalizacoesPorConfirmar: dig['por_confirmar'] ?? 0,
      digitalizacoesComErro: dig['erro'] ?? 0,
      movimentosPorConciliar: movPorConciliar,
      impostosAVencer,
      efatura,
      faltasPorDecidir: faltasPonto,
      feriasPorDecidir: feriasPendentes,
      documentosRepetidos: repetidos,
    },
  };
}
