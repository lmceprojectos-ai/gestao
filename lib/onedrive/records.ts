// Deteção de duplicados e criação de registos reais nos módulos da aplicação
// a partir dos dados extraídos de uma digitalização.
import { prisma } from '@/lib/db';
import { classificarCategoria } from '@/lib/categorizacao';

function parseValor(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function parseData(v: any): Date | null {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function dayRange(d: Date): { gte: Date; lte: Date } {
  const gte = new Date(d);
  gte.setHours(0, 0, 0, 0);
  const lte = new Date(d);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

// Tenta encontrar um registo já existente equivalente. Devolve o id ou null.
export async function detectDuplicate(
  modulo: string,
  dados: any
): Promise<string | null> {
  if (!dados) return null;
  try {
    if (modulo === 'despesa') {
      const valor = parseValor(dados.valor);
      const data = parseData(dados.data);
      if (valor === null || !data) return null;
      const { gte, lte } = dayRange(data);
      const found = await prisma.despesa.findFirst({
        where: {
          valor,
          data: { gte, lte },
          ...(dados.entidadeNome
            ? { entidadeNome: { contains: String(dados.entidadeNome).slice(0, 40) } }
            : {}),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
    if (modulo === 'fatura_fornecedor') {
      const valor = parseValor(dados.valor);
      const num = dados.numeroFatura || dados.referencia;
      if (valor === null && !num) return null;
      const found = await prisma.fatura.findFirst({
        where: {
          tipo: 'recebida',
          origem: 'fornecedor',
          ...(num
            ? { OR: [{ numero: String(num) }, { referencia: String(num) }] }
            : {}),
          ...(valor !== null ? { valor } : {}),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
    if (modulo === 'pagamento') {
      const valor = parseValor(dados.valor);
      if (valor === null) return null;
      const found = await prisma.pagamento.findFirst({
        where: {
          valor,
          ...(dados.referencia ? { referencia: String(dados.referencia) } : {}),
          ...(dados.fornecedorNome && !dados.referencia
            ? { descricao: { contains: String(dados.fornecedorNome).slice(0, 30) } }
            : {}),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
    if (modulo === 'imposto') {
      const valor = parseValor(dados.valor);
      if (valor === null) return null;
      const found = await prisma.imposto.findFirst({
        where: {
          valor,
          ...(dados.tipo ? { tipo: String(dados.tipo) } : {}),
          ...(dados.periodo ? { periodo: String(dados.periodo) } : {}),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
    if (modulo === 'seguro') {
      const valor = parseValor(dados.valor);
      if (valor === null && !dados.apolice) return null;
      const found = await prisma.seguro.findFirst({
        where: {
          ...(dados.apolice ? { apolice: String(dados.apolice) } : {}),
          ...(valor !== null ? { valor } : {}),
          ...(dados.seguradora ? { seguradora: { contains: String(dados.seguradora).slice(0, 30) } } : {}),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
    if (modulo === 'vencimento') {
      if (!dados.funcionario || !dados.periodo) return null;
      const found = await prisma.vencimento.findFirst({
        where: {
          funcionario: { contains: String(dados.funcionario).slice(0, 40) },
          periodo: String(dados.periodo),
        },
        select: { id: true },
      });
      return found?.id || null;
    }
  } catch (e) {
    console.error('detectDuplicate error', e);
  }
  return null;
}

interface FicheiroInfo {
  cloudStoragePath: string | null;
  contentType: string | null;
  nomeOriginal: string | null;
  isPublic: boolean;
}

// Cria o registo real no módulo correspondente. Devolve o id do registo criado.
export async function criarRegisto(
  modulo: string,
  dados: any,
  ficheiro: FicheiroInfo,
  criadoPor: string
): Promise<string> {
  const d = dados || {};
  if (modulo === 'despesa') {
    const rec = await prisma.despesa.create({
      data: {
        descricao: String(d.descricao || d.entidadeNome || 'Despesa importada').slice(0, 200),
        categoria: d.categoria ? String(d.categoria) : null,
        valor: parseValor(d.valor) ?? 0,
        data: parseData(d.data) ?? new Date(),
        estado: 'pendente',
        entidadeNome: d.entidadeNome ? String(d.entidadeNome) : null,
        entidadeNif: d.entidadeNif ? String(d.entidadeNif) : null,
        cloudStoragePath: ficheiro.cloudStoragePath,
        contentType: ficheiro.contentType,
        nomeOriginal: ficheiro.nomeOriginal,
        isPublic: ficheiro.isPublic,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  // Resolve (ou cria) o fornecedor a partir dos dados extraídos.
  async function resolverFornecedor(): Promise<string | null> {
    let fornecedorId: string | null = null;
    const nif = d.fornecedorNif ? String(d.fornecedorNif).replace(/\D/g, '') : null;
    const nome = d.fornecedorNome ? String(d.fornecedorNome).slice(0, 150) : null;
    if (nif) {
      const existing = await prisma.fornecedor.findUnique({ where: { nif } });
      if (existing) fornecedorId = existing.id;
    }
    if (!fornecedorId && nome) {
      const existing = await prisma.fornecedor.findFirst({
        where: { nome: { equals: nome } },
        select: { id: true },
      });
      if (existing) fornecedorId = existing.id;
    }
    if (!fornecedorId && (nome || nif)) {
      const novo = await prisma.fornecedor.create({
        data: { nome: nome || `Fornecedor ${nif}`, nif: nif || null },
        select: { id: true },
      });
      fornecedorId = novo.id;
    }
    return fornecedorId;
  }

  if (modulo === 'fatura_fornecedor') {
    const fornecedorId = await resolverFornecedor();
    const nome = d.fornecedorNome ? String(d.fornecedorNome).slice(0, 150) : null;
    const nif = d.fornecedorNif ? String(d.fornecedorNif).replace(/\D/g, '') : null;
    const numero = d.numeroFatura
      ? String(d.numeroFatura)
      : d.referencia
      ? String(d.referencia)
      : null;
    // Categoria automática: usa a que o utilizador atribuiu ao mesmo
    // fornecedor no passado; se for fornecedor novo, classifica por IA.
    const categoriaAuto =
      d.categoria && String(d.categoria).trim()
        ? String(d.categoria).trim()
        : await classificarCategoria({ nif, nome, descricao: d.descricao });
    const rec = await prisma.fatura.create({
      data: {
        numero,
        descricao: String(d.descricao || nome || 'Fatura de fornecedor').slice(0, 200),
        tipo: 'recebida',
        origem: 'fornecedor',
        valor: parseValor(d.valor),
        estado: 'rascunho',
        dataEmissao: parseData(d.dataFatura) ?? parseData(d.dataPagamento),
        referencia: numero,
        categoria: categoriaAuto,
        entidadeNome: nome,
        entidadeNif: nif,
        fornecedorId,
        cloudStoragePath: ficheiro.cloudStoragePath || '',
        contentType: ficheiro.contentType || 'application/pdf',
        nomeOriginal: ficheiro.nomeOriginal || '',
        isPublic: ficheiro.isPublic,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  if (modulo === 'pagamento') {
    const fornecedorId = await resolverFornecedor();
    const nome = d.fornecedorNome ? String(d.fornecedorNome).slice(0, 150) : null;
    // Fatura(s) a conciliar escolhida(s) na validação. Aceita um id único
    // ('faturaId') ou uma lista ('faturaIds'). Cada fatura conciliada gera o
    // seu próprio pagamento (a partir do mesmo comprovativo) para que o saldo
    // de cada fatura seja abatido corretamente.
    const faturaIds: string[] = Array.isArray(d.faturaIds)
      ? d.faturaIds.map((x: any) => String(x)).filter(Boolean)
      : d.faturaId
      ? [String(d.faturaId)]
      : [];

    const dataPagamento = parseData(d.dataPagamento) ?? new Date();
    const referencia = d.referencia ? String(d.referencia) : null;
    const descricaoBase = String(d.descricao || nome || 'Pagamento importado').slice(0, 200);
    const valorTotal = parseValor(d.valor) ?? 0;

    if (faturaIds.length > 0) {
      // Distribui o valor do comprovativo pelas faturas conciliadas: por
      // omissão usa o saldo pendente de cada fatura; se só houver uma, usa o
      // valor total do comprovativo.
      const faturas = await prisma.fatura.findMany({
        where: { id: { in: faturaIds } },
        include: { pagamentos: { select: { valor: true, estado: true } } },
      });
      const byId = new Map(faturas.map((f) => [f.id, f]));
      let primeiroId: string | null = null;
      for (const fid of faturaIds) {
        const f = byId.get(fid);
        if (!f) continue;
        const pago = (f.pagamentos || [])
          .filter((p) => p.estado === 'pago')
          .reduce((s, p) => s + (p.valor || 0), 0);
        const saldo = Math.max(0, (f.valor || 0) - pago);
        const valorPag =
          faturaIds.length === 1 ? valorTotal : saldo > 0 ? saldo : valorTotal;
        const rec = await prisma.pagamento.create({
          data: {
            descricao: (f.numero ? `Pag. ${f.numero}` : descricaoBase).slice(0, 200),
            valor: valorPag,
            dataPagamento,
            estado: 'pago',
            referencia,
            fornecedorId,
            faturaId: fid,
            reconciliado: true,
            reciboPath: ficheiro.cloudStoragePath,
            reciboContentType: ficheiro.contentType,
            reciboOriginal: ficheiro.nomeOriginal,
            criadoPor,
          },
          select: { id: true },
        });
        if (!primeiroId) primeiroId = rec.id;
      }
      if (primeiroId) return primeiroId;
    }

    // Sem faturas a conciliar: comportamento anterior (pagamento pendente).
    const rec = await prisma.pagamento.create({
      data: {
        descricao: descricaoBase,
        valor: valorTotal,
        dataPagamento,
        estado: 'pendente',
        referencia,
        fornecedorId,
        reciboPath: ficheiro.cloudStoragePath,
        reciboContentType: ficheiro.contentType,
        reciboOriginal: ficheiro.nomeOriginal,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  if (modulo === 'imposto') {
    const rec = await prisma.imposto.create({
      data: {
        tipo: d.tipo ? String(d.tipo) : 'Outro',
        descricao: d.descricao ? String(d.descricao) : null,
        valor: parseValor(d.valor) ?? 0,
        periodo: d.periodo ? String(d.periodo) : null,
        dataVencimento: parseData(d.dataVencimento),
        estado: 'pendente',
        referencia: d.referencia ? String(d.referencia) : null,
        entidadeNome: d.entidadeNome ? String(d.entidadeNome) : null,
        entidadeNif: d.entidadeNif ? String(d.entidadeNif) : null,
        cloudStoragePath: ficheiro.cloudStoragePath,
        contentType: ficheiro.contentType,
        nomeOriginal: ficheiro.nomeOriginal,
        isPublic: ficheiro.isPublic,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  if (modulo === 'seguro') {
    const rec = await prisma.seguro.create({
      data: {
        tipo: d.tipo ? String(d.tipo) : 'outro',
        seguradora: d.seguradora ? String(d.seguradora) : null,
        apolice: d.apolice ? String(d.apolice) : null,
        valor: parseValor(d.valor) ?? 0,
        periodicidade: d.periodicidade ? String(d.periodicidade) : null,
        dataInicio: parseData(d.dataInicio),
        dataVencimento: parseData(d.dataVencimento),
        estado: 'pendente',
        referencia: d.referencia ? String(d.referencia) : null,
        entidadeNif: d.entidadeNif ? String(d.entidadeNif) : null,
        cloudStoragePath: ficheiro.cloudStoragePath,
        contentType: ficheiro.contentType,
        nomeOriginal: ficheiro.nomeOriginal,
        isPublic: ficheiro.isPublic,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  if (modulo === 'vencimento') {
    const rec = await prisma.vencimento.create({
      data: {
        funcionario: String(d.funcionario || 'Funcionário').slice(0, 150),
        cargo: d.cargo ? String(d.cargo) : null,
        valorBruto: parseValor(d.valorBruto) ?? 0,
        valorLiquido: parseValor(d.valorLiquido),
        segSocial: parseValor(d.segSocial),
        irs: parseValor(d.irs),
        outrosDescontos: parseValor(d.outrosDescontos),
        periodo: d.periodo ? String(d.periodo) : null,
        dataPagamento: parseData(d.dataPagamento),
        estado: 'pendente',
        cloudStoragePath: ficheiro.cloudStoragePath,
        contentType: ficheiro.contentType,
        nomeOriginal: ficheiro.nomeOriginal,
        isPublic: ficheiro.isPublic,
        criadoPor,
      },
      select: { id: true },
    });
    return rec.id;
  }
  throw new Error(`Módulo desconhecido: ${modulo}`);
}
