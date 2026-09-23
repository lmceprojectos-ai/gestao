export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { FORNECEDORES_FIXOS, quantidadeEsperada, registoCorresponde, MES_INICIO_VERIFICACAO } from '@/lib/fornecedores-fixos';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoVerif = agora.getFullYear();
    const mesInicio = Math.min(MES_INICIO_VERIFICACAO, mesAtual);
    const inicioVerificacao = new Date(anoVerif, mesInicio, 1);

    const [contas, recebimentosPendentes, pagamentosPendentes, totalRecebimentos, totalPagamentos, recebimentosMes, pagamentosMes, faturasPendentes, despesasFixas, faturasMes, despesasMesAgg, pagamentosFornecedoresMesAgg, faturasFornecedorPeriodo, despesasPeriodo, pagamentosPeriodo, impostosPeriodo, segurosMensais] = await Promise.all([
      prisma.contaBancaria.findMany({ where: { ativa: true }, orderBy: { nome: 'asc' } }),
      prisma.recebimento.count({ where: { estado: 'pendente' } }),
      prisma.pagamento.count({ where: { estado: 'pendente' } }),
      prisma.recebimento.aggregate({ where: { estado: 'pago' }, _sum: { valor: true } }),
      prisma.pagamento.aggregate({ where: { estado: 'pago' }, _sum: { valor: true } }),
      prisma.recebimento.findMany({
        where: {
          dataRecebimento: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        select: { valor: true, estado: true, dataRecebimento: true },
      }),
      prisma.pagamento.findMany({
        where: {
          dataPagamento: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        select: { valor: true, estado: true, dataPagamento: true },
      }),
      // Faturas pendentes de pagamento — apenas faturas emitidas a clientes ou
      // recebidas de fornecedores que ainda NÃO estão liquidadas.
      // Excluímos recibos, orçamentos, guias e notas de crédito/débito (não são
      // documentos "a pagar"). A liquidação (Faturas-Recibo e faturas já pagas
      // no Moloni) é filtrada abaixo através de valorReconciliado.
      // Apenas a partir de 01/01/2026.
      prisma.fatura.findMany({
        where: {
          estado: { not: 'anulado' },
          tipo: { in: ['emitida', 'recebida'] },
          pagamentoValidado: false,
          pagamentos: { none: {} },
          recebimentos: { none: {} },
          dataEmissao: { gte: new Date('2026-01-01') },
        },
        include: { cliente: { select: { nome: true } }, fornecedor: { select: { nome: true } } },
        orderBy: { dataVencimento: 'asc' },
      }),
      // Despesas recorrentes/fixas (últimos 3 meses)
      prisma.despesa.findMany({
        where: { estado: 'pago' },
        orderBy: { data: 'desc' },
        take: 50,
        select: { descricao: true, categoria: true, valor: true, data: true },
      }),
      // Faturas do mês atual (para visualização de faturação)
      prisma.fatura.findMany({
        where: {
          dataEmissao: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          estado: { not: 'anulado' },
        },
        select: { valor: true, tipo: true, dataEmissao: true, pagamentos: { select: { id: true } }, recebimentos: { select: { id: true } } },
      }),
      // Total de despesas do mês atual (custos)
      prisma.despesa.aggregate({
        where: { data: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        _sum: { valor: true },
      }),
      // Pagamentos a fornecedores efetuados no mês atual (saída de dinheiro)
      prisma.pagamento.aggregate({
        where: {
          dataPagamento: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          fornecedorId: { not: null },
          estado: 'pago',
        },
        _sum: { valor: true },
      }),
      // Faturas de fornecedores desde o início da verificação (deteção de faturas fixas em falta)
      prisma.fatura.findMany({
        where: {
          dataEmissao: { gte: inicioVerificacao },
          estado: { not: 'anulado' },
          OR: [{ origem: 'fornecedor' }, { tipo: 'recebida' }],
        },
        select: { id: true, numero: true, descricao: true, dataEmissao: true, cloudStoragePath: true, fornecedor: { select: { nome: true } } },
      }),
      // Despesas desde o início da verificação
      prisma.despesa.findMany({
        where: { data: { gte: inicioVerificacao } },
        select: { id: true, descricao: true, categoria: true, data: true, cloudStoragePath: true, seguroId: true, fornecedor: { select: { nome: true } } },
      }),
      // Pagamentos desde o início da verificação
      prisma.pagamento.findMany({
        where: { dataPagamento: { gte: inicioVerificacao } },
        select: { descricao: true, dataPagamento: true, fornecedor: { select: { nome: true } } },
      }),
      // Impostos desde o início da verificação (ex.: Segurança Social)
      prisma.imposto.findMany({
        where: { dataVencimento: { gte: inicioVerificacao } },
        select: { id: true, tipo: true, descricao: true, dataVencimento: true, cloudStoragePath: true },
      }),
      // Seguros com periodicidade mensal — controlados como despesas fixas mensais
      prisma.seguro.findMany({
        where: { periodicidade: 'mensal' },
        select: { id: true, tipo: true, seguradora: true, apolice: true, valor: true, dataEmissao: true },
      }),
    ]);

    const totalDespesasMes = despesasMesAgg?._sum?.valor ?? 0;
    const totalPagamentosFornecedoresMes = pagamentosFornecedoresMesAgg?._sum?.valor ?? 0;

    // ---- Resultado ACUMULADO desde o início da atividade (janeiro de 2026) ----
    // O painel principal mostra o resultado desde o início do ano civil
    // (janeiro) até ao dia atual, e não apenas o mês corrente.
    const INICIO_ATIVIDADE = new Date(2026, 0, 1); // 1 de janeiro de 2026
    const [faturasAcumLista, despesasAcumLista, fornecedoresFaturadoLista] = await Promise.all([
      // Faturas emitidas (faturação) desde o início do ano
      prisma.fatura.findMany({
        where: { tipo: 'emitida', estado: { not: 'anulado' }, dataEmissao: { gte: INICIO_ATIVIDADE } },
        select: { id: true, numero: true, descricao: true, valor: true, dataEmissao: true, cliente: { select: { nome: true } } },
        orderBy: { dataEmissao: 'desc' },
      }),
      // Despesas desde o início do ano
      prisma.despesa.findMany({
        where: { data: { gte: INICIO_ATIVIDADE } },
        select: { id: true, descricao: true, categoria: true, valor: true, data: true, estado: true, fornecedor: { select: { nome: true } } },
        orderBy: { data: 'desc' },
      }),
      // Faturas RECEBIDAS de fornecedores (o que os fornecedores faturaram) desde
      // o início do ano — NÃO são os pagamentos efetuados, mas o valor faturado.
      prisma.fatura.findMany({
        where: {
          estado: { not: 'anulado' },
          dataEmissao: { gte: INICIO_ATIVIDADE },
          OR: [{ tipo: 'recebida' }, { origem: 'fornecedor' }],
        },
        select: { id: true, numero: true, descricao: true, valor: true, dataEmissao: true, fornecedor: { select: { nome: true } } },
        orderBy: { dataEmissao: 'desc' },
      }),
    ]);

    const faturacaoAcumulada = (faturasAcumLista ?? []).reduce((a: number, f: any) => a + (f?.valor || 0), 0);
    const despesasAcumuladas = (despesasAcumLista ?? []).reduce((a: number, d: any) => a + (d?.valor || 0), 0);
    const fornecedoresFaturado = (fornecedoresFaturadoLista ?? []).reduce((a: number, f: any) => a + (f?.valor || 0), 0);
    // Mantido por compatibilidade com o cliente (a subtração usa o faturado).
    const pagFornecedoresAcumulados = fornecedoresFaturado;
    const resultadoAcumulado = faturacaoAcumulada - despesasAcumuladas - fornecedoresFaturado;

    // Agregado POR MÊS reutilizável: recebe uma lista de documentos com
    // { dataEmissao|data, valor } e devolve uma linha por mês (a mais recente
    // primeiro), com a mesma forma das linhas dos fornecedores. Assim a
    // Faturação e as Despesas passam a ser vistas "por mês", tal como os
    // fornecedores, mantendo o filtro de datas (estilo Moloni) do modal.
    const MESES_PT_LABEL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const substantivo = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
    function agregarPorMes(
      lista: any[],
      campoData: 'dataEmissao' | 'data',
      sing: string,
      plur: string,
    ) {
      const mapa = new Map<string, { ano: number; mes: number; valor: number; docs: number }>();
      (lista ?? []).forEach((it: any) => {
        const raw = it?.[campoData];
        if (!raw) return;
        const dt = new Date(raw);
        if (isNaN(dt.getTime())) return;
        const ano = dt.getFullYear();
        const mes = dt.getMonth();
        const chave = `${ano}-${mes}`;
        const cur = mapa.get(chave) ?? { ano, mes, valor: 0, docs: 0 };
        cur.valor += it?.valor || 0;
        cur.docs += 1;
        mapa.set(chave, cur);
      });
      return Array.from(mapa.values())
        .sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes))
        .map((m) => ({
          id: `${m.ano}-${m.mes}`,
          label: `${MESES_PT_LABEL[m.mes]} de ${m.ano}`,
          entidade: substantivo(m.docs, sing, plur),
          data: new Date(m.ano, m.mes, 1).toISOString(),
          valor: m.valor,
        }));
    }

    const movimentosFaturacao = agregarPorMes(faturasAcumLista ?? [], 'dataEmissao', 'fatura', 'faturas');
    const movimentosDespesas = agregarPorMes(despesasAcumLista ?? [], 'data', 'despesa', 'despesas');
    const movimentosPagamentosFornecedores = agregarPorMes(fornecedoresFaturadoLista ?? [], 'dataEmissao', 'fatura', 'faturas');

    // Remover da lista de "faturas pendentes" as que já estão liquidadas:
    // - Faturas-Recibo (invoiceReceipts) são pagas na emissão;
    // - Faturas cujo valor reconciliado no Moloni cobre o total.
    const EPS = 0.01;
    const faturasPendentesFiltradas = (faturasPendentes ?? [])
      .filter((f: any) => {
        if (f?.moloniDocType === 'invoiceReceipts') return false;
        const total = typeof f?.valor === 'number' ? f.valor : null;
        const reconc = typeof f?.valorReconciliado === 'number' ? f.valorReconciliado : null;
        if (total != null && reconc != null && reconc >= total - EPS) return false;
        return true;
      })
      .slice(0, 20);

    // ---- Faturas fixas mensais em falta (do mês de início até ao mês atual) ----
    const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const TIPO_SEGURO_LABEL: Record<string, string> = { recheio: 'Recheio', vida: 'Vida', saude: 'Saúde', acidentes_trabalho: 'Acidentes de Trabalho', viaturas: 'Viaturas' };
    // Todos os seguros mensais são agrupados numa única linha no painel.
    const SEGUROS_FIXOS_LABEL = 'Seguros — Generali Tranquilidade';
    const nomeSeguro = (s: any): string => {
      const t = TIPO_SEGURO_LABEL[s?.tipo] || (s?.tipo ? String(s.tipo) : 'Seguro');
      const seg = s?.seguradora ? ` · ${s.seguradora}` : '';
      return `Seguro ${t}${seg}`;
    };

    type RegistoPeriodo = {
      data: Date;
      textos: (string | null | undefined)[];
      tipo?: 'fatura' | 'despesa' | 'imposto';
      docId?: string;
      temDoc?: boolean;
      label?: string;
      seguroId?: string | null;
    };
    const registosPeriodo: RegistoPeriodo[] = [];
    (faturasFornecedorPeriodo ?? []).forEach((f: any) => {
      if (f?.dataEmissao) registosPeriodo.push({
        data: new Date(f.dataEmissao),
        textos: [f?.fornecedor?.nome, f?.descricao],
        tipo: 'fatura',
        docId: f?.id,
        temDoc: !!(f?.cloudStoragePath && String(f.cloudStoragePath).length > 0),
        label: f?.numero || f?.descricao || f?.fornecedor?.nome || 'Fatura',
      });
    });
    (despesasPeriodo ?? []).forEach((d: any) => {
      if (d?.data) registosPeriodo.push({
        data: new Date(d.data),
        textos: [d?.fornecedor?.nome, d?.descricao, d?.categoria],
        tipo: 'despesa',
        docId: d?.id,
        temDoc: !!(d?.cloudStoragePath && String(d.cloudStoragePath).length > 0),
        label: d?.descricao || d?.fornecedor?.nome || 'Despesa',
        seguroId: d?.seguroId ?? null,
      });
    });
    (pagamentosPeriodo ?? []).forEach((p: any) => {
      if (p?.dataPagamento) registosPeriodo.push({ data: new Date(p.dataPagamento), textos: [p?.fornecedor?.nome, p?.descricao] });
    });
    (impostosPeriodo ?? []).forEach((i: any) => {
      if (i?.dataVencimento) registosPeriodo.push({
        data: new Date(i.dataVencimento),
        textos: [i?.tipo, i?.descricao],
        tipo: 'imposto',
        docId: i?.id,
        temDoc: !!(i?.cloudStoragePath && String(i.cloudStoragePath).length > 0),
        label: i?.descricao || i?.tipo || 'Imposto',
      });
    });

    // Confirmações manuais (faturas fixas dadas como OK) no período em verificação.
    // Cada confirmação é um registo individual — podem existir várias por
    // fornecedor/mês (ex.: IFTHENPAY = 3 faturas por mês).
    const confirmacoes = await prisma.faturaFixaConfirmacao.findMany({
      where: { ano: anoVerif, mes: { gte: mesInicio, lte: mesAtual } },
      orderBy: { createdAt: 'asc' },
    });
    const confsPorChave = new Map<string, any[]>();
    (confirmacoes ?? []).forEach((c: any) => {
      const chave = `${c.mes}-${c.fornecedor}`;
      if (!confsPorChave.has(chave)) confsPorChave.set(chave, []);
      confsPorChave.get(chave)!.push(c);
    });

    // Deteções automáticas que o utilizador anulou (correspondência errada).
    const ignoradas = await prisma.faturaFixaIgnorada.findMany({ where: { ano: anoVerif } });
    const ignoradoSet = new Set<string>((ignoradas ?? []).map((i: any) => `${i.tipo}|${i.docId}|${i.fornecedor}`));
    const isIgnorado = (r: any, nome: string) => !!(r?.tipo && r?.docId && ignoradoSet.has(`${r.tipo}|${r.docId}|${nome}`));

    type FornecedorEmFalta = { nome: string; esperado: number; contabilizadas: number; emFalta: number; seguros?: { id: string; tipo: string; seguradora: string | null; dataEmissao: string | null; valor: number; label: string }[] };
    type ItemConfirmado = { id: string; nome: string; faturaId: string | null; faturaNumero: string | null; esperado: number; contabilizadas: number; auto?: boolean; tipo?: 'fatura' | 'despesa' | 'imposto'; docId?: string; temDoc?: boolean };
    const fornecedoresFixosEmFaltaPorMes: { ano: number; mes: number; label: string; fornecedores: FornecedorEmFalta[] }[] = [];
    const fornecedoresFixosConfirmadosPorMes: { ano: number; mes: number; label: string; itens: ItemConfirmado[] }[] = [];
    for (let m = mesInicio; m <= mesAtual; m++) {
      const inicio = new Date(anoVerif, m, 1);
      const fim = new Date(anoVerif, m + 1, 1);
      const registosMes = registosPeriodo.filter((r) => r.data >= inicio && r.data < fim);

      const emFaltaMes: FornecedorEmFalta[] = [];
      const confirmadasMes: ItemConfirmado[] = [];

      for (const f of FORNECEDORES_FIXOS) {
        const esperado = quantidadeEsperada(f);
        // Faturas detetadas automaticamente. Contamos apenas DOCUMENTOS reais
        // (faturas/despesas/impostos com docId) — que são exatamente os itens
        // anuláveis mostrados no painel. Os pagamentos não contam aqui: são
        // sempre a liquidação de um documento já contabilizado (evita contagem
        // dupla e permite que, ao anular a deteção, a obrigação volte a "em falta").
        const autoCount = registosMes.filter((r) => r.tipo && r.docId && registoCorresponde(r.textos, f) && !isIgnorado(r, f.nome)).length;
        // Confirmações manuais deste fornecedor/mês.
        const confs = confsPorChave.get(`${m}-${f.nome}`) ?? [];
        const manualCount = confs.length;
        const contabilizadas = autoCount + manualCount;
        const emFalta = Math.max(0, esperado - contabilizadas);

        // Obrigações cujo documento só existe no mês seguinte (ex.: Segurança
        // Social) não são sinalizadas no mês corrente, pois ainda não venceram.
        const ignorarMesCorrente = f.naoVerificarMesCorrente && m === mesAtual;

        if (emFalta > 0 && !ignorarMesCorrente) {
          emFaltaMes.push({ nome: f.nome, esperado, contabilizadas, emFalta });
        }
        confs.forEach((c: any) => {
          confirmadasMes.push({
            id: c.id,
            nome: f.nome,
            faturaId: c?.faturaId ?? null,
            faturaNumero: c?.faturaNumero ?? null,
            esperado,
            contabilizadas,
          });
        });

        // Documentos detetados automaticamente (faturas/despesas/impostos
        // digitalizados que correspondem a este fornecedor fixo). Surgem como
        // cópias verdes só de leitura no painel de despesas fixas — não são
        // contabilizados novamente (já entram em autoCount acima).
        registosMes
          .filter((r) => registoCorresponde(r.textos, f) && r.tipo && r.docId && !isIgnorado(r, f.nome))
          .forEach((r) => {
            confirmadasMes.push({
              id: `auto-${r.tipo}-${r.docId}`,
              nome: f.nome,
              faturaId: null,
              faturaNumero: r.label ?? null,
              esperado,
              contabilizadas,
              auto: true,
              tipo: r.tipo,
              docId: r.docId,
              temDoc: !!r.temDoc,
            });
          });
      }

      // ---- Seguros mensais: UMA única linha consolidada por mês ----
      // Todos os seguros de periodicidade mensal são agrupados numa só entrada
      // "Seguros — Generali Tranquilidade". Ao validar, o utilizador vê a LISTA
      // de seguros (com a respetiva data de emissão) — não faturas nem despesas.
      const segurosLista = (segurosMensais ?? []).map((s: any) => ({
        id: s.id,
        tipo: s.tipo,
        seguradora: s.seguradora ?? null,
        dataEmissao: s.dataEmissao ? new Date(s.dataEmissao).toISOString() : null,
        valor: typeof s.valor === 'number' ? s.valor : 0,
        label: nomeSeguro(s),
      }));
      if (segurosLista.length > 0) {
        const nome = SEGUROS_FIXOS_LABEL;
        const esperado = 1;
        const confs = confsPorChave.get(`${m}-${nome}`) ?? [];
        const contabilizadas = confs.length;
        const emFalta = Math.max(0, esperado - contabilizadas);
        if (emFalta > 0) {
          emFaltaMes.push({ nome, esperado, contabilizadas, emFalta, seguros: segurosLista });
        }
        confs.forEach((c: any) => {
          confirmadasMes.push({
            id: c.id,
            nome,
            faturaId: null,
            faturaNumero: c?.faturaNumero ?? 'Seguros validados',
            esperado,
            contabilizadas,
          });
        });
      }
      if (emFaltaMes.length > 0) {
        fornecedoresFixosEmFaltaPorMes.push({ ano: anoVerif, mes: m, label: `${MESES_PT[m]} de ${anoVerif}`, fornecedores: emFaltaMes });
      }
      if (confirmadasMes.length > 0) {
        fornecedoresFixosConfirmadosPorMes.push({ ano: anoVerif, mes: m, label: `${MESES_PT[m]} de ${anoVerif}`, itens: confirmadasMes });
      }
    }
    const fornecedoresFixosEmFaltaTotal = fornecedoresFixosEmFaltaPorMes.reduce(
      (a, x) => a + x.fornecedores.reduce((b, y) => b + y.emFalta, 0),
      0,
    );

    const saldoTotal = (contas ?? []).reduce((acc: number, c: any) => acc + (c?.saldoAtual ?? 0), 0);
    const valorRecebido = totalRecebimentos?._sum?.valor ?? 0;
    const valorPago = totalPagamentos?._sum?.valor ?? 0;

    // Últimos recebimentos e pagamentos
    const ultimosRecebimentos = await prisma.recebimento.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { cliente: { select: { nome: true } } },
    });

    const ultimosPagamentos = await prisma.pagamento.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { fornecedor: { select: { nome: true } } },
    });

    // Calcular faturação do mês
    const faturasEmitidas = (faturasMes ?? []).filter((f: any) => f.tipo === 'emitida');
    const totalFaturado = faturasEmitidas.reduce((a: number, f: any) => a + (f.valor || 0), 0);
    const totalFaturadoPago = faturasEmitidas.filter((f: any) => (f.recebimentos?.length || 0) > 0 || (f.pagamentos?.length || 0) > 0).reduce((a: number, f: any) => a + (f.valor || 0), 0);

    // Despesas fixas mensais (agrupar por categoria)
    const despesasPorCategoria: Record<string, number> = {};
    (despesasFixas ?? []).forEach((d: any) => {
      const cat = d.categoria || 'outro';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + (d.valor || 0);
    });

    // Pagamentos/recebimentos em falta
    const recebimentosEmFalta = await prisma.recebimento.findMany({
      where: { estado: 'pendente' },
      include: { cliente: { select: { nome: true } } },
      orderBy: { dataRecebimento: 'asc' },
      take: 10,
    });
    const pagamentosEmFalta = await prisma.pagamento.findMany({
      where: { estado: 'pendente' },
      include: { fornecedor: { select: { nome: true } } },
      orderBy: { dataPagamento: 'asc' },
      take: 10,
    });

    // Saldo diário do mês atual
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const movimentosMes = await prisma.movimentoBancario.findMany({
      where: { dataMovimento: { gte: inicioMes } },
      select: { dataMovimento: true, valor: true, tipo: true },
      orderBy: { dataMovimento: 'asc' },
    });
    const saldoDiarioMap: Record<string, number> = {};
    (movimentosMes ?? []).forEach((m: any) => {
      const dia = new Date(m.dataMovimento).toISOString().split('T')[0];
      const v = m.tipo === 'credito' ? (m.valor || 0) : -(m.valor || 0);
      saldoDiarioMap[dia] = (saldoDiarioMap[dia] || 0) + v;
    });
    // Also add recebimentos and pagamentos
    (recebimentosMes ?? []).filter((r: any) => r.estado === 'pago').forEach((r: any) => {
      const dia = new Date(r.dataRecebimento).toISOString().split('T')[0];
      saldoDiarioMap[dia] = (saldoDiarioMap[dia] || 0) + (r.valor || 0);
    });
    (pagamentosMes ?? []).filter((p: any) => p.estado === 'pago').forEach((p: any) => {
      const dia = new Date(p.dataPagamento).toISOString().split('T')[0];
      saldoDiarioMap[dia] = (saldoDiarioMap[dia] || 0) - (p.valor || 0);
    });
    // Build sorted array with running balance
    const diasOrdenados = Object.keys(saldoDiarioMap).sort();
    // Subtract current month movements to get starting balance
    const totalMovMes = diasOrdenados.reduce((a, d) => a + saldoDiarioMap[d], 0);
    let saldoInicio = saldoTotal - totalMovMes;
    const saldoDiario = diasOrdenados.map(dia => {
      saldoInicio += saldoDiarioMap[dia];
      return { dia, variacao: saldoDiarioMap[dia], saldo: saldoInicio };
    });

    return NextResponse.json({
      contas: contas ?? [],
      saldoTotal,
      recebimentosPendentes: recebimentosPendentes ?? 0,
      pagamentosPendentes: pagamentosPendentes ?? 0,
      valorRecebido,
      valorPago,
      ultimosRecebimentos: ultimosRecebimentos ?? [],
      ultimosPagamentos: ultimosPagamentos ?? [],
      recebimentosMes: recebimentosMes ?? [],
      pagamentosMes: pagamentosMes ?? [],
      faturasPendentes: faturasPendentesFiltradas,
      totalFaturado,
      totalFaturadoPago,
      totalDespesasMes,
      totalPagamentosFornecedoresMes,
      resultadoMes: totalFaturado - totalDespesasMes - totalPagamentosFornecedoresMes,
      // Resultado acumulado desde o início do ano (janeiro)
      inicioAtividade: INICIO_ATIVIDADE.toISOString(),
      faturacaoAcumulada,
      despesasAcumuladas,
      pagFornecedoresAcumulados,
      fornecedoresFaturado,
      resultadoAcumulado,
      movimentosFaturacao,
      movimentosDespesas,
      movimentosPagamentosFornecedores,
      fornecedoresFixosEmFaltaPorMes,
      fornecedoresFixosConfirmadosPorMes,
      fornecedoresFixosEmFaltaCount: fornecedoresFixosEmFaltaTotal,
      despesasPorCategoria,
      recebimentosEmFalta: recebimentosEmFalta ?? [],
      pagamentosEmFalta: pagamentosEmFalta ?? [],
      saldoDiario: saldoDiario ?? [],
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 });
  }
}