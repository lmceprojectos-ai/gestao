export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const emprestimos = await prisma.emprestimoSocio.findMany({
      include: {
        devolucoes: { orderBy: { dataDevolucao: 'desc' } },
      },
      orderBy: { dataEmprestimo: 'desc' },
    });

    // Calculate remaining balance
    const result = emprestimos.map((e) => {
      const totalDevolvido = e.devolucoes.reduce((sum, d) => sum + d.valor, 0);
      const saldoPendente = e.valor - totalDevolvido;
      return { ...e, totalDevolvido, saldoPendente };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Empréstimos GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { socioNome, descricao, valor, dataEmprestimo, contaBancariaId, notas, cloudStoragePath, contentType, nomeOriginal } = body ?? {};

    if (!socioNome || !valor || !dataEmprestimo) {
      return NextResponse.json({ error: 'Nome do sócio, valor e data são obrigatórios' }, { status: 400 });
    }

    const emprestimo = await prisma.emprestimoSocio.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        socioNome,
        descricao: descricao || null,
        valor: parseFloat(valor),
        dataEmprestimo: new Date(dataEmprestimo),
        contaBancariaId: contaBancariaId || null,
        notas: notas || null,
        cloudStoragePath: cloudStoragePath || null,
        contentType: contentType || null,
        nomeOriginal: nomeOriginal || null,
      },
    });

    return NextResponse.json(emprestimo, { status: 201 });
  } catch (error: any) {
    console.error('Empréstimos POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
