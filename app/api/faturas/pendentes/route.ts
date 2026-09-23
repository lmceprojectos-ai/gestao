export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fornecedorId = searchParams.get('fornecedorId');
    const clienteId = searchParams.get('clienteId');
    const nif = searchParams.get('nif');
    const nome = (searchParams.get('nome') || '').trim();
    const valor = searchParams.get('valor');
    const tipo = searchParams.get('tipo') || 'recebida'; // 'recebida' (fornecedores) ou 'emitida' (clientes)

    // Build where clause for unpaid invoices
    const where: any = {
      tipo,
      estado: { not: 'anulado' },
    };

    if (tipo === 'recebida') {
      // Find by fornecedor: id > nif > nome da entidade
      if (fornecedorId) {
        where.fornecedorId = fornecedorId;
      } else if (nif) {
        const fornecedor = await prisma.fornecedor.findUnique({ where: { nif } });
        if (fornecedor) {
          where.fornecedorId = fornecedor.id;
        } else {
          where.entidadeNif = nif;
        }
      } else if (nome) {
        const fornecedor = await prisma.fornecedor.findFirst({ where: { nome: { contains: nome } } });
        if (fornecedor) {
          where.fornecedorId = fornecedor.id;
        } else {
          where.entidadeNome = { contains: nome };
        }
      }
    } else if (tipo === 'emitida') {
      // Find by cliente: id > nif > nome da entidade
      if (clienteId) {
        where.clienteId = clienteId;
      } else if (nif) {
        const cliente = await prisma.cliente.findFirst({ where: { nif } });
        if (cliente) {
          where.clienteId = cliente.id;
        } else {
          where.entidadeNif = nif;
        }
      } else if (nome) {
        const cliente = await prisma.cliente.findFirst({ where: { nome: { contains: nome } } });
        if (cliente) {
          where.clienteId = cliente.id;
        } else {
          where.entidadeNome = { contains: nome };
        }
      }
    }

    // Get faturas with related payments/receipts
    const includeRelations: any = {
      pagamentos: { select: { id: true, valor: true, estado: true } },
      recebimentos: { select: { id: true, valor: true, estado: true } },
    };
    if (tipo === 'recebida') {
      includeRelations.fornecedor = { select: { id: true, nome: true, nif: true } };
    } else {
      includeRelations.cliente = { select: { id: true, nome: true, nif: true } };
    }

    const faturas = await prisma.fatura.findMany({
      where,
      include: includeRelations,
      orderBy: { dataEmissao: 'desc' },
      take: 100,
    });

    // Calculate remaining amount for each fatura
    const faturasComSaldo = faturas.map((f) => {
      // For emitida (client invoices), calculate from recebimentos
      // For recebida (supplier invoices), calculate from pagamentos
      const pagosViaRecebimentos = (f.recebimentos || [])
        .filter((r: any) => r.estado === 'recebido')
        .reduce((sum: number, r: any) => sum + r.valor, 0);
      const pagosViaPagamentos = (f.pagamentos || [])
        .filter((p: any) => p.estado === 'pago')
        .reduce((sum: number, p: any) => sum + p.valor, 0);
      const totalPago = tipo === 'emitida' ? pagosViaRecebimentos : pagosViaPagamentos;
      const saldoPendente = (f.valor || 0) - totalPago;
      return {
        ...f,
        totalPago,
        saldoPendente,
        paga: saldoPendente <= 0,
      };
    }).filter((f) => f.saldoPendente > 0);

    return NextResponse.json(faturasComSaldo);
  } catch (error: any) {
    console.error('Faturas pendentes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
