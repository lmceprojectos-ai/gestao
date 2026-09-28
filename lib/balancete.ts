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
      select: { conta: true, valor: true, tipo: true, data: true, origem: true, destino: true },
    }),
  ]);
  const movs = intervalo ? todos.filter((m) => m.data >= intervalo.gte) : todos;
  const igual = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
  return contas.map((c) => {
    const daConta = movs.filter((m) => igual(m.conta, c.nome));
    const ateFimDoAno = todos.filter((m) => igual(m.conta, c.nome));
    const receitas = daConta.filter((m) => m.tipo === 'RECEITA').reduce((s, m) => s + m.valor, 0);
    const despesas = daConta.filter((m) => m.tipo === 'DESPESA').reduce((s, m) => s + Math.abs(m.valor), 0);
    // Como no Sumário do Excel: entrada = transferências recebidas (e saldo transitado),
    // saída = transferências enviadas.
    const internos = daConta.filter((m) => m.tipo === 'INTERNO');
    const entrada = internos.filter((m) => igual(m.destino, c.nome) || (!m.origem && !m.destino && m.valor > 0)).reduce((s, m) => s + m.valor, 0);
    const saida = internos.filter((m) => igual(m.origem, c.nome) || (!m.origem && !m.destino && m.valor < 0)).reduce((s, m) => s - m.valor, 0);
    // Saldo: com saldo de abertura anterior ao fim do ano, abertura + movimentos
    // posteriores; senão, o saldo do ano como no Sumário do Excel.
    const fimDoAno = intervalo?.lt ?? null;
    const temAbertura = !!c.dataAbertura && (!fimDoAno || c.dataAbertura < fimDoAno);
    const saldo = temAbertura
      ? c.saldoAbertura + ateFimDoAno.filter((m) => m.data > c.dataAbertura!).reduce((s, m) => s + m.valor, 0)
      : receitas - despesas + entrada - saida;
    return {
      id: c.id,
      nome: c.nome,
      saldoAbertura: temAbertura ? c.saldoAbertura : 0,
      dataAbertura: temAbertura ? c.dataAbertura!.toISOString() : null,
      saldo: arred(saldo),
      receitas: arred(receitas),
      despesas: arred(despesas),
      entrada: arred(entrada),
      saida: arred(saida),
      saldoDoAno: arred(receitas - despesas + entrada - saida),
      movimentos: daConta.length,
    };
  });
}

// ---------- Substituir um ano ----------
// Apaga os movimentos de um ano antes de importar a versão corrigida do ficheiro.
// Antes de apagar guarda-os num backup (Gestão → Backups), que se pode repor.
export async function apagarAno(ano: number, criadoPor: string | null) {
  const intervalo = intervaloAno(ano)!;
  const movs = await prisma.balanceteMovimento.findMany({ where: { data: intervalo }, orderBy: { data: 'asc' } });
  if (!movs.length) return { apagados: 0, backupId: null as string | null };
  const { guardarBackup } = await import('@/lib/backups');
  const json = {
    formato: 'balancete2026-backup-v1',
    exportadoEm: new Date().toISOString(),
    origem: 'balancete (app) — antes de substituir o ano ' + ano,
    accounts: [],
    movements: movs.map((m) => ({
      id: m.id, date: m.data.toISOString(), value: m.valor, description: m.descricao, method: m.metodo, account: m.conta,
      category: m.categoria, subcategory: m.subcategoria, fiscal: m.fiscal, type: m.tipo, quarter: m.trimestre,
      origin: m.origem, destination: m.destino, note: m.nota, createdAt: m.createdAt.toISOString(),
    })),
  };
  const b = await guardarBackup({
    nome: `balancete-${ano}-antes-de-substituir.json`,
    descricao: `Balancete ${ano}: ${movs.length} movimentos guardados antes de substituir o ano`,
    origem: 'balancete (substituir ano)',
    conteudo: Buffer.from(JSON.stringify(json)),
    criadoPor,
  });
  const r = await prisma.balanceteMovimento.deleteMany({ where: { data: intervalo } });
  return { apagados: r.count, backupId: b.id };
}

// ---------- Importação de movimentos lidos de um ficheiro ----------
// Não duplica: um movimento igual (conta, data, valor e descrição) que já exista
// não volta a entrar; movimentos iguais repetidos no mesmo dia contam-se um a um.
const chave = (m: { conta: string; data: Date; valor: number; descricao: string }) =>
  `${m.conta.toLowerCase()}|${m.data.toISOString().slice(0, 10)}|${m.valor.toFixed(2)}|${m.descricao.replace(/\s+/g, ' ').trim().toLowerCase()}`;

export async function importarMovimentosLidos(
  movs: import('@/lib/balancete-ficheiro').MovimentoLido[],
  listas: { grupo: string; nome: string }[] = [],
) {
  const res = { receitas: 0, despesas: 0, internos: 0, repetidos: 0, contasNovas: [] as string[], porAno: {} as Record<string, number> };
  if (!movs.length) return res;
  const de = new Date(Math.min(...movs.map((m) => m.data.getTime())));
  const ate = new Date(Math.max(...movs.map((m) => m.data.getTime())) + 1);
  const existentes = await prisma.balanceteMovimento.findMany({
    where: { data: { gte: de, lte: ate } },
    select: { conta: true, data: true, valor: true, descricao: true },
  });
  const contagem = new Map<string, number>();
  for (const e of existentes) contagem.set(chave(e), (contagem.get(chave(e)) ?? 0) + 1);

  const novos = movs.filter((m) => {
    const k = chave(m);
    const n = contagem.get(k) ?? 0;
    if (n > 0) { contagem.set(k, n - 1); res.repetidos++; return false; }
    return true;
  });

  const contas = new Set((await prisma.balanceteConta.findMany({ select: { nome: true } })).map((c) => c.nome.toLowerCase()));
  for (const nome of [...new Set(novos.map((m) => m.conta))]) {
    if (contas.has(nome.toLowerCase())) continue;
    await prisma.balanceteConta.create({ data: { nome, saldoAbertura: 0 } });
    res.contasNovas.push(nome);
  }
  if (listas.length) await prisma.balanceteLista.createMany({ data: listas, skipDuplicates: true });

  for (let i = 0; i < novos.length; i += 200) {
    await prisma.balanceteMovimento.createMany({ data: novos.slice(i, i + 200) });
  }
  for (const m of novos) {
    if (m.tipo === 'RECEITA') res.receitas++; else if (m.tipo === 'DESPESA') res.despesas++; else res.internos++;
    const a = String(m.data.getUTCFullYear());
    res.porAno[a] = (res.porAno[a] ?? 0) + 1;
  }
  return res;
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
