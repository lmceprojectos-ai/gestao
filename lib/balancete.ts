// Balancete (trazido de balancete2026.abacusai.app): contas, movimentos,
// categorias e os cálculos do dashboard, das contas e dos relatórios.
// Regras (iguais às do site original):
//  - receitas = movimentos RECEITA; despesas = movimentos DESPESA (em valor absoluto);
//    os INTERNO (transferências entre contas) não contam como receita nem despesa;
//  - saldo de uma conta = saldo de abertura + movimentos posteriores à data de abertura.
import { prisma } from '@/lib/db';

export const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const arred = (n: number) => Math.round(n * 100) / 100;

// Movimentos de um ano (datas guardadas à meia-noite UTC).
export function intervaloAno(ano?: number | null) {
  if (!ano) return undefined;
  return { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) };
}

export function anoDoPedido(v: string | null) {
  const n = Number(v);
  return Number.isInteger(n) && n > 2000 && n < 2100 ? n : null;
}

// Anos com movimentos, mais o ano atual (o mais recente primeiro).
export async function anosBalancete() {
  const [primeiro, ultimo] = await Promise.all([
    prisma.balanceteMovimento.findFirst({ orderBy: { data: 'asc' }, select: { data: true } }),
    prisma.balanceteMovimento.findFirst({ orderBy: { data: 'desc' }, select: { data: true } }),
  ]);
  const atual = new Date().getFullYear();
  const de = Math.min(primeiro?.data.getUTCFullYear() ?? atual, atual);
  const ate = Math.max(ultimo?.data.getUTCFullYear() ?? atual, atual);
  const anos: number[] = [];
  for (let a = ate; a >= de; a--) anos.push(a);
  return anos;
}

export function trimestreDe(data: Date) {
  return `Q${Math.floor(data.getUTCMonth() / 3) + 1}`;
}

// ---------- Importação de um backup do site original ----------
type BackupBalancete = {
  formato?: string;
  accounts?: { name: string; openingBalance?: number; openingDate?: string | null }[];
  categories?: { categories?: { name: string }[]; subcategories?: { name: string }[]; methods?: { name: string }[] };
  movements?: {
    id: string; date: string; value: number; description: string; method?: string | null; account: string;
    category?: string | null; subcategory?: string | null; fiscal?: string | null; type: string; quarter?: string | null;
    origin?: string | null; destination?: string | null; note?: string | null; createdAt?: string; updatedAt?: string;
  }[];
};

export function eBackupBalancete(json: any): json is BackupBalancete {
  return !!json && Array.isArray(json.movements) && Array.isArray(json.accounts);
}

// Importa contas, listas e movimentos. Não duplica: movimentos com o mesmo id
// e contas/listas com o mesmo nome são ignorados.
export async function importarBackupBalancete(b: BackupBalancete) {
  const res = { contas: 0, listas: 0, movimentos: 0, jaExistiam: 0 };

  for (const a of b.accounts ?? []) {
    const existe = await prisma.balanceteConta.findUnique({ where: { nome: a.name } });
    if (existe) continue;
    await prisma.balanceteConta.create({
      data: { nome: a.name, saldoAbertura: a.openingBalance ?? 0, dataAbertura: a.openingDate ? new Date(a.openingDate) : null },
    });
    res.contas++;
  }

  const listas = [
    ...(b.categories?.categories ?? []).map((c) => ({ grupo: 'categoria', nome: c.name })),
    ...(b.categories?.subcategories ?? []).map((c) => ({ grupo: 'subcategoria', nome: c.name })),
    ...(b.categories?.methods ?? []).map((c) => ({ grupo: 'metodo', nome: c.name })),
  ];
  if (listas.length) {
    const r = await prisma.balanceteLista.createMany({ data: listas, skipDuplicates: true });
    res.listas = r.count;
  }

  const movs = b.movements ?? [];
  const existentes = new Set((await prisma.balanceteMovimento.findMany({ select: { id: true } })).map((m) => m.id));
  const novos = movs.filter((m) => !existentes.has(m.id));
  res.jaExistiam = movs.length - novos.length;
  for (let i = 0; i < novos.length; i += 200) {
    const r = await prisma.balanceteMovimento.createMany({
      data: novos.slice(i, i + 200).map((m) => {
        const data = new Date(m.date);
        return {
          id: m.id, data, valor: m.value, descricao: m.description, metodo: m.method ?? null, conta: m.account,
          categoria: m.category ?? null, subcategoria: m.subcategory ?? null, fiscal: m.fiscal ?? null,
          tipo: m.type, trimestre: m.quarter || trimestreDe(data), origem: m.origin ?? null, destino: m.destination ?? null,
          nota: m.note ?? null, createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        };
      }),
      skipDuplicates: true,
    });
    res.movimentos += r.count;
  }
  return res;
}

// ---------- Cálculos ----------
// Com ano: receitas/despesas desse ano e saldo no fim desse ano.
async function contasComSaldo(ano?: number | null) {
  const intervalo = intervaloAno(ano);
  const [contas, todos] = await Promise.all([
    prisma.balanceteConta.findMany({ orderBy: { nome: 'asc' } }),
    prisma.balanceteMovimento.findMany({
      where: intervalo ? { data: { lt: intervalo.lt } } : undefined,
      select: { conta: true, valor: true, tipo: true, data: true },
    }),
  ]);
  const movs = intervalo ? todos.filter((m) => m.data >= intervalo.gte) : todos;
  return contas.map((c) => {
    const daConta = movs.filter((m) => m.conta.toLowerCase() === c.nome.toLowerCase());
    const ateFimDoAno = todos.filter((m) => m.conta.toLowerCase() === c.nome.toLowerCase());
    const posteriores = c.dataAbertura ? ateFimDoAno.filter((m) => m.data > c.dataAbertura!) : ateFimDoAno;
    const receitas = daConta.filter((m) => m.tipo === 'RECEITA').reduce((s, m) => s + m.valor, 0);
    const despesas = daConta.filter((m) => m.tipo === 'DESPESA').reduce((s, m) => s + Math.abs(m.valor), 0);
    return {
      id: c.id,
      nome: c.nome,
      saldoAbertura: c.saldoAbertura,
      dataAbertura: c.dataAbertura?.toISOString() ?? null,
      saldo: arred(c.saldoAbertura + posteriores.reduce((s, m) => s + m.valor, 0)),
      receitas: arred(receitas),
      despesas: arred(despesas),
      movimentos: daConta.length,
    };
  });
}

export async function dashboardBalancete(ano?: number | null) {
  const intervalo = intervaloAno(ano);
  const [movs, contas] = await Promise.all([
    prisma.balanceteMovimento.findMany({ where: intervalo ? { data: intervalo } : undefined, select: { valor: true, tipo: true, trimestre: true, categoria: true } }),
    contasComSaldo(ano),
  ]);
  const receitas = movs.filter((m) => m.tipo === 'RECEITA');
  const despesas = movs.filter((m) => m.tipo === 'DESPESA');
  const totalReceitas = arred(receitas.reduce((s, m) => s + m.valor, 0));
  const totalDespesas = arred(despesas.reduce((s, m) => s + Math.abs(m.valor), 0));
  const trimestres = TRIMESTRES.map((q) => {
    const r = receitas.filter((m) => m.trimestre === q).reduce((s, m) => s + m.valor, 0);
    const d = despesas.filter((m) => m.trimestre === q).reduce((s, m) => s + Math.abs(m.valor), 0);
    return { trimestre: q, receitas: arred(r), despesas: arred(d), margem: r ? arred(((r - d) / r) * 100) : 0 };
  });
  const porCategoria = new Map<string, number>();
  for (const m of despesas) porCategoria.set(m.categoria || 'Sem Categoria', (porCategoria.get(m.categoria || 'Sem Categoria') ?? 0) + Math.abs(m.valor));
  return {
    totalReceitas,
    totalDespesas,
    resultado: arred(totalReceitas - totalDespesas),
    totalMovimentos: movs.length,
    saldoTotal: arred(contas.reduce((s, c) => s + c.saldo, 0)),
    contas,
    trimestres,
    categorias: [...porCategoria].map(([nome, valor]) => ({ nome, valor: arred(valor) })).sort((a, b) => b.valor - a.valor),
  };
}

export { contasComSaldo };

export async function relatoriosBalancete(ano?: number | null) {
  const intervalo = intervaloAno(ano);
  const movs = await prisma.balanceteMovimento.findMany({ where: intervalo ? { data: intervalo } : undefined, orderBy: { data: 'desc' } });
  const cat = new Map<string, { receitas: number; despesas: number }>();
  for (const m of movs) {
    if (m.tipo === 'INTERNO') continue;
    const k = m.categoria || 'Sem Categoria';
    const e = cat.get(k) ?? { receitas: 0, despesas: 0 };
    if (m.tipo === 'RECEITA') e.receitas += m.valor; else e.despesas += Math.abs(m.valor);
    cat.set(k, e);
  }
  const porTrimestre = TRIMESTRES.map((q) => {
    const r = movs.filter((m) => m.trimestre === q && m.tipo === 'RECEITA').reduce((s, m) => s + m.valor, 0);
    const d = movs.filter((m) => m.trimestre === q && m.tipo === 'DESPESA').reduce((s, m) => s + Math.abs(m.valor), 0);
    return { trimestre: q, receitas: arred(r), despesas: arred(d), total: arred(r - d) };
  });
  return {
    porCategoria: [...cat].map(([nome, v]) => ({ nome, receitas: arred(v.receitas), despesas: arred(v.despesas), balanco: arred(v.receitas - v.despesas) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
    porTrimestre,
    fiscais: movs.filter((m) => m.fiscal).map((m) => ({
      id: m.id, data: m.data.toISOString(), descricao: m.descricao, conta: m.conta, valor: m.valor, fiscal: m.fiscal, tipo: m.tipo,
    })),
  };
}
