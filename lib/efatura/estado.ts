// Estado de um mês do e-Fatura: cada documento cruzado com a app (ver match.ts).
import { prisma } from '@/lib/db';
import { cruzar, DocApp } from '@/lib/efatura/match';

export async function estadoMesEFatura(mes: string) {
  const documentos = await prisma.eFaturaDocumento.findMany({
    where: { mes },
    orderBy: [{ dataEmissao: 'asc' }, { emitenteNome: 'asc' }],
  });

  // Documentos da app num intervalo à volta do mês (a data guardada pode diferir uns dias).
  const [ano, m] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, m - 1, 1) - 15 * 86400000);
  const fim = new Date(Date.UTC(ano, m, 1) + 15 * 86400000);
  const [faturas, despesas] = await Promise.all([
    prisma.fatura.findMany({
      where: {
        OR: [{ origem: 'fornecedor' }, { tipo: 'recebida' }],
        estado: { not: 'anulado' },
        dataEmissao: { gte: inicio, lt: fim },
      },
      select: { id: true, tipo: true, numero: true, entidadeNif: true, entidadeNome: true, valor: true, dataEmissao: true },
    }),
    prisma.despesa.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { id: true, descricao: true, entidadeNif: true, entidadeNome: true, valor: true, data: true },
    }),
  ]);
  const docsApp: DocApp[] = [
    ...faturas.map((f) => ({ id: f.id, origem: 'fatura' as const, tipo: f.tipo, numero: f.numero, nif: f.entidadeNif, nome: f.entidadeNome, valor: f.valor, data: f.dataEmissao })),
    ...despesas.map((d) => ({ id: d.id, origem: 'despesa' as const, tipo: null, numero: d.descricao, nif: d.entidadeNif, nome: d.entidadeNome, valor: d.valor, data: d.data })),
  ];

  const correspondencias = cruzar(documentos, docsApp);
  const linhas = documentos.map((d) => {
    const c = correspondencias.get(d.id);
    const estado: 'na_app' | 'em_falta' | 'ignorado' = d.ignorado ? 'ignorado' : c ? 'na_app' : 'em_falta';
    return {
      ...d,
      estado,
      correspondencia: c
        ? { forma: c.forma, origem: c.doc.origem, id: c.doc.id, numero: c.doc.numero, valor: c.doc.valor, data: c.doc.data }
        : null,
    };
  });

  const emFalta = linhas.filter((l) => l.estado === 'em_falta');
  const resumo = {
    total: linhas.length,
    naApp: linhas.filter((l) => l.estado === 'na_app').length,
    emFalta: emFalta.length,
    ignorados: linhas.filter((l) => l.estado === 'ignorado').length,
    valorEmFalta: Math.round(emFalta.reduce((s, l) => s + l.total, 0) * 100) / 100,
  };
  return { linhas, resumo };
}

export async function mesesEFatura() {
  const meses = await prisma.eFaturaDocumento.groupBy({ by: ['mes'], _count: { _all: true }, orderBy: { mes: 'desc' } });
  return meses.map((m) => ({ mes: m.mes, total: m._count._all }));
}
