export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { importarMovimentosLidos } from '@/lib/balancete';
import { lerFicheiroBalancete } from '@/lib/balancete-ficheiro';

// Importa um ficheiro para o Balancete: o Excel do balancete (folhas Despesas/
// Receitas Q1–Q4 e Mov. Internos) ou o extrato de um trimestre (o sinal decide).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Escolha um ficheiro' }, { status: 400 });
    const conta = fd.get('conta') ? String(fd.get('conta')) : null;
    const contas = (await prisma.balanceteConta.findMany({ select: { nome: true } })).map((c) => c.nome);
    const leitura = lerFicheiroBalancete(Buffer.from(await file.arrayBuffer()), conta, contas);
    if (!leitura.movimentos.length) return NextResponse.json({ error: 'Não encontrei movimentos no ficheiro' }, { status: 400 });
    const r = await importarMovimentosLidos(leitura.movimentos, leitura.listas);
    return NextResponse.json({ ...r, formato: leitura.formato, lidos: leitura.movimentos.length, avisos: leitura.avisos.slice(0, 20) });
  } catch (e: any) {
    console.error('Importar balancete:', e);
    return NextResponse.json({ error: e.message || 'Erro ao importar' }, { status: 500 });
  }
}
