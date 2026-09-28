export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { anoDoPedido, intervaloAno } from '@/lib/balancete';

const POR_PAGINA = 50;

// GET ?ano=&q=&trimestre=&tipo=&categoria=&conta=&pagina=1&ordem=data|valor&dir=asc|desc
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const where: any = {};
  const q = (sp.get('q') || '').trim();
  if (q) where.descricao = { contains: q };
  const intervalo = intervaloAno(anoDoPedido(sp.get('ano')));
  if (intervalo) where.data = intervalo;
  if (sp.get('trimestre')) where.trimestre = sp.get('trimestre');
  if (sp.get('tipo')) where.tipo = sp.get('tipo');
  if (sp.get('conta')) where.conta = sp.get('conta');
  const categoria = sp.get('categoria');
  if (categoria === '__sem__') where.categoria = null;
  else if (categoria) where.categoria = categoria;
  const pagina = Math.max(1, Number(sp.get('pagina')) || 1);
  const ordem = sp.get('ordem') === 'valor' ? 'valor' : 'data';
  const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
  try {
    const [total, soma, movimentos] = await Promise.all([
      prisma.balanceteMovimento.count({ where }),
      prisma.balanceteMovimento.aggregate({ where, _sum: { valor: true } }),
      prisma.balanceteMovimento.findMany({
        where,
        orderBy: [{ [ordem]: dir }, { id: 'asc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);
    return NextResponse.json({ movimentos, total, soma: Math.round((soma._sum.valor ?? 0) * 100) / 100, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
