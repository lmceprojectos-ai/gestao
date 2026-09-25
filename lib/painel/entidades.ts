// Dados dos dashboards de Clientes e de Fornecedores: um resumo de cada
// página desse menu (faturas, recibos, notas de crédito, recebimentos /
// pagamentos, e-Fatura). Os critérios de "por receber"/"por pagar" são os
// mesmos do dashboard principal (lib/dashboard/atencao.ts).
import { prisma } from '@/lib/db';
import { estadoMesEFatura, mesesEFatura } from '@/lib/efatura/estado';

export type Lado = 'clientes' | 'fornecedores';

const INICIO_ANO = new Date('2026-01-01');
const TIPOS_NOTA = ['nota', 'nota_credito', 'nota_debito'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const arred = (n: number) => Math.round(n * 100) / 100;
const soma = (l: { valor: number | null }[]) => arred(l.reduce((s, f) => s + (f.valor ?? 0), 0));

export async function painelEntidades(lado: Lado) {
  const clientes = lado === 'clientes';
  const origem = clientes ? 'cliente' : 'fornecedor';
  const tipoFatura = clientes ? 'emitida' : 'recebida';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const selDoc = {
    id: true, tipo: true, numero: true, descricao: true, valor: true, valorReconciliado: true, moloniDocType: true,
    dataEmissao: true, dataVencimento: true, entidadeNome: true, pagamentoValidado: true,
    cliente: { select: { id: true, nome: true } }, fornecedor: { select: { id: true, nome: true } },
    _count: { select: { pagamentos: true, recebimentos: true } },
  } as const;

  const [faturas, recibos, notas, orcamentos, entidades, movPendentes, movMes] = await Promise.all([
    prisma.fatura.findMany({
      where: { tipo: tipoFatura, estado: { not: 'anulado' }, dataEmissao: { gte: INICIO_ANO } },
      select: selDoc,
      orderBy: { dataEmissao: 'desc' },
    }),
    prisma.fatura.findMany({
      where: { tipo: 'recibo', origem, estado: { not: 'anulado' }, dataEmissao: { gte: INICIO_ANO } },
      select: selDoc,
      orderBy: { dataEmissao: 'desc' },
    }),
    prisma.fatura.findMany({
      where: { tipo: { in: TIPOS_NOTA }, origem, estado: { not: 'anulado' }, dataEmissao: { gte: INICIO_ANO } },
      select: selDoc,
      orderBy: { dataEmissao: 'desc' },
    }),
    clientes ? Promise.resolve(0) : prisma.fatura.count({ where: { tipo: 'orcamento', origem: 'fornecedor', estado: { not: 'anulado' } } }),
    clientes ? prisma.cliente.count() : prisma.fornecedor.count(),
    clientes
      ? prisma.recebimento.aggregate({ where: { estado: 'pendente' }, _sum: { valor: true }, _count: { _all: true } })
      : prisma.pagamento.aggregate({ where: { estado: 'pendente' }, _sum: { valor: true }, _count: { _all: true } }),
    clientes
      ? prisma.recebimento.aggregate({ where: { estado: { in: ['recebido', 'pago'] }, dataRecebimento: { gte: inicioMes } }, _sum: { valor: true }, _count: { _all: true } })
      : prisma.pagamento.aggregate({ where: { estado: 'pago', dataPagamento: { gte: inicioMes } }, _sum: { valor: true }, _count: { _all: true } }),
  ]);

  const nomeEntidade = (f: (typeof faturas)[number]) =>
    (clientes ? f.cliente?.nome : f.fornecedor?.nome) ?? f.entidadeNome ?? 'Sem entidade';
  const idEntidade = (f: (typeof faturas)[number]) => (clientes ? f.cliente?.id : f.fornecedor?.id) ?? null;

  // Por receber / por pagar: sem pagamento associado nem validado, e não liquidadas no Moloni.
  const porLiquidar = faturas.filter((f) => {
    if (f.pagamentoValidado || f._count.pagamentos > 0 || f._count.recebimentos > 0) return false;
    if (f.moloniDocType === 'invoiceReceipts') return false;
    if (f.valor != null && f.valorReconciliado != null && f.valorReconciliado >= f.valor - 0.01) return false;
    return (f.valor ?? 0) > 0;
  });
  const dataRef = (f: (typeof faturas)[number]) => f.dataVencimento ?? f.dataEmissao;
  const vencidas = porLiquidar.filter((f) => { const d = dataRef(f); return !!d && d < hoje; });
  const pendentesOrdenadas = [...porLiquidar].sort((a, b) => (dataRef(a)?.getTime() ?? 0) - (dataRef(b)?.getTime() ?? 0));

  // Faturado por mês (desde janeiro)
  const porMes = Array.from({ length: hoje.getMonth() + 1 }, (_, m) => ({ mes: MESES[m], valor: 0 }));
  for (const f of faturas) {
    if (!f.dataEmissao || f.dataEmissao.getFullYear() !== hoje.getFullYear()) continue;
    const m = f.dataEmissao.getMonth();
    if (porMes[m]) porMes[m].valor += f.valor ?? 0;
  }
  porMes.forEach((m) => (m.valor = arred(m.valor)));

  // Principais entidades pelo valor faturado no ano
  const mapa = new Map<string, { id: string | null; nome: string; valor: number; documentos: number; pendente: number }>();
  for (const f of faturas) {
    const nome = nomeEntidade(f);
    const chave = idEntidade(f) ?? nome.toLowerCase();
    const e = mapa.get(chave) ?? { id: idEntidade(f), nome, valor: 0, documentos: 0, pendente: 0 };
    e.valor += f.valor ?? 0;
    e.documentos++;
    mapa.set(chave, e);
  }
  for (const f of porLiquidar) {
    const e = mapa.get(idEntidade(f) ?? nomeEntidade(f).toLowerCase());
    if (e) e.pendente += f.valor ?? 0;
  }
  const principais = [...mapa.values()]
    .map((e) => ({ ...e, valor: arred(e.valor), pendente: arred(e.pendente) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const doc = (f: (typeof faturas)[number]) => ({
    id: f.id,
    tipo: f.tipo,
    numero: f.numero || f.descricao || 'S/N',
    entidade: nomeEntidade(f),
    valor: f.valor ?? 0,
    dataEmissao: f.dataEmissao?.toISOString() ?? null,
    dataVencimento: f.dataVencimento?.toISOString() ?? null,
    vencida: (() => { const d = dataRef(f); return !!d && d < hoje; })(),
  });

  const ultimos = [...faturas, ...recibos, ...notas]
    .sort((a, b) => (b.dataEmissao?.getTime() ?? 0) - (a.dataEmissao?.getTime() ?? 0))
    .slice(0, 10)
    .map(doc);

  // e-Fatura (só fornecedores): documentos do mês mais recente importado que faltam na app.
  let efatura: { mes: string; emFalta: number; valorEmFalta: number } | null = null;
  if (!clientes) {
    const meses = await mesesEFatura();
    if (meses[0]) {
      const { resumo } = await estadoMesEFatura(meses[0].mes);
      efatura = { mes: meses[0].mes, emFalta: resumo.emFalta, valorEmFalta: resumo.valorEmFalta };
    }
  }

  const faturasMes = faturas.filter((f) => f.dataEmissao && f.dataEmissao >= inicioMes);

  return {
    lado,
    entidades,
    faturas: {
      ano: soma(faturas), quantidadeAno: faturas.length,
      mes: soma(faturasMes), quantidadeMes: faturasMes.length,
    },
    pendentes: {
      total: soma(porLiquidar), quantidade: porLiquidar.length,
      vencidas: vencidas.length, valorVencido: soma(vencidas),
      itens: pendentesOrdenadas.slice(0, 10).map(doc),
    },
    recibos: { total: soma(recibos), quantidade: recibos.length },
    notas: {
      total: soma(notas), quantidade: notas.length,
      credito: notas.filter((n) => n.tipo !== 'nota_debito').length,
      debito: notas.filter((n) => n.tipo === 'nota_debito').length,
    },
    orcamentos,
    movimentos: {
      pendentes: { total: arred(movPendentes._sum.valor ?? 0), quantidade: movPendentes._count._all },
      mes: { total: arred(movMes._sum.valor ?? 0), quantidade: movMes._count._all },
    },
    efatura,
    porMes,
    principais,
    ultimos,
  };
}
