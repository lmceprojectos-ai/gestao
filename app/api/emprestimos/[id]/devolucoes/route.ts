export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { valor, dataDevolucao, descricao, contaBancariaId } = body ?? {};

    if (!valor || !dataDevolucao) {
      return NextResponse.json({ error: 'Valor e data de devolução são obrigatórios' }, { status: 400 });
    }

    // Verify the emprestimo exists
    const emprestimo = await prisma.emprestimoSocio.findUnique({
      where: { id: params.id },
      include: { devolucoes: true },
    });
    if (!emprestimo) return NextResponse.json({ error: 'Empréstimo não encontrado' }, { status: 404 });

    const totalDevolvido = emprestimo.devolucoes.reduce((sum, d) => sum + d.valor, 0);
    const saldoPendente = emprestimo.valor - totalDevolvido;
    const valorDev = parseFloat(valor);

    if (valorDev > saldoPendente + 0.01) {
      return NextResponse.json({ error: `Valor excede o saldo pendente (${saldoPendente.toFixed(2)}€)` }, { status: 400 });
    }

    // Create devolucao
    const devolucao = await prisma.devolucaoEmprestimo.create({
      data: {
        criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
        emprestimoId: params.id,
        valor: valorDev,
        dataDevolucao: new Date(dataDevolucao),
        descricao: descricao || null,
        contaBancariaId: contaBancariaId || null,
      },
    });

    // Update emprestimo estado
    const novoTotalDevolvido = totalDevolvido + valorDev;
    const novoEstado = novoTotalDevolvido >= emprestimo.valor - 0.01 ? 'devolvido' : 'parcial';
    await prisma.emprestimoSocio.update({
      where: { id: params.id },
      data: { estado: novoEstado },
    });

    return NextResponse.json(devolucao, { status: 201 });
  } catch (error: any) {
    console.error('Devolução POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const devolucaoId = searchParams.get('devolucaoId');
    if (!devolucaoId) return NextResponse.json({ error: 'ID da devolução é obrigatório' }, { status: 400 });

    await prisma.devolucaoEmprestimo.delete({ where: { id: devolucaoId } });

    // Recalculate estado
    const emprestimo = await prisma.emprestimoSocio.findUnique({
      where: { id: params.id },
      include: { devolucoes: true },
    });
    if (emprestimo) {
      const totalDevolvido = emprestimo.devolucoes.reduce((sum, d) => sum + d.valor, 0);
      const novoEstado = totalDevolvido <= 0 ? 'ativo' : totalDevolvido >= emprestimo.valor - 0.01 ? 'devolvido' : 'parcial';
      await prisma.emprestimoSocio.update({ where: { id: params.id }, data: { estado: novoEstado } });
    }

    return NextResponse.json({ message: 'Devolução eliminada' });
  } catch (error: any) {
    console.error('Devolução DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
