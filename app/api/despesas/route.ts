export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const data = await prisma.despesa.findMany({
      include: { fornecedor: { select: { id: true, nome: true } }, contaBancaria: { select: { id: true, nome: true } }, seguro: { select: { id: true, tipo: true, seguradora: true, apolice: true } } },
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.descricao) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    const estado = body.estado || 'pendente';
    const valor = Number(body.valor) || 0;
    const contaBancariaId = body.contaBancariaId || null;

    const data = await prisma.$transaction(async (tx) => {
      const created = await tx.despesa.create({
        data: {
          criadoPor: (session?.user as any)?.name || (session?.user as any)?.email || null,
          descricao: body.descricao,
          categoria: body.categoria || null,
          subcategoria: body.subcategoria || null,
          valor,
          data: body.data ? new Date(body.data) : new Date(),
          estado,
          fornecedorId: body.fornecedorId || null,
          seguroId: body.seguroId || null,
          entidadeNome: body.entidadeNome || null,
          entidadeNif: body.entidadeNif || null,
          metodoPagamento: body.metodoPagamento || null,
          contaBancariaId,
          notas: body.notas || null,
          cloudStoragePath: body.cloudStoragePath || null,
          contentType: body.contentType || null,
          nomeOriginal: body.nomeOriginal || null,
          comprovativoPath: body.comprovativoPath || null,
          comprovativoContentType: body.comprovativoContentType || null,
          comprovativoNomeOriginal: body.comprovativoNomeOriginal || null,
          isPublic: body.isPublic || false,
        },
      });
      // Se paga a partir de uma conta bancária, reduz o saldo dessa conta
      if (estado === 'pago' && contaBancariaId) {
        await tx.contaBancaria.update({ where: { id: contaBancariaId }, data: { saldoAtual: { decrement: valor } } });
      }
      return created;
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
