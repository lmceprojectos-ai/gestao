export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { cruzar, DocApp } from '@/lib/efatura/match';

// Documentos do e-Fatura de um mês, com o estado de cada um na app.
// GET /api/efatura?mes=AAAA-MM  (sem mês: o mais recente importado)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const mesesRaw = await prisma.eFaturaDocumento.groupBy({ by: ['mes'], _count: { _all: true }, orderBy: { mes: 'desc' } });
    const meses = mesesRaw.map((m) => ({ mes: m.mes, total: m._count._all }));
    const mes = req.nextUrl.searchParams.get('mes') || meses[0]?.mes;
    if (!mes) return NextResponse.json({ meses, mes: null, documentos: [], resumo: null });

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
      const estado = d.ignorado ? 'ignorado' : c ? 'na_app' : 'em_falta';
      return {
        ...d,
        estado,
        correspondencia: c
          ? { forma: c.forma, origem: c.doc.origem, id: c.doc.id, numero: c.doc.numero, valor: c.doc.valor, data: c.doc.data }
          : null,
      };
    });

    const resumo = {
      total: linhas.length,
      naApp: linhas.filter((l) => l.estado === 'na_app').length,
      emFalta: linhas.filter((l) => l.estado === 'em_falta').length,
      ignorados: linhas.filter((l) => l.estado === 'ignorado').length,
      valorEmFalta: Math.round(linhas.filter((l) => l.estado === 'em_falta').reduce((s, l) => s + l.total, 0) * 100) / 100,
    };

    return NextResponse.json({ meses, mes, documentos: linhas, resumo });
  } catch (error: any) {
    console.error('efatura GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Apaga todos os documentos importados de um mês (para voltar a importar).
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const mes = req.nextUrl.searchParams.get('mes');
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Indique o mês (AAAA-MM)' }, { status: 400 });
    const r = await prisma.eFaturaDocumento.deleteMany({ where: { mes } });
    return NextResponse.json({ success: true, apagados: r.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
