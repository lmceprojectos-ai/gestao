export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getMoloniCompanyId, createMoloniCustomer, createMoloniSupplier } from '@/lib/moloni';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { type } = body; // 'clientes', 'fornecedores'

    const companyId = await getMoloniCompanyId();
    const results: { pushed: number; errors: string[] } = { pushed: 0, errors: [] };

    if (type === 'clientes') {
      // Push local clients without moloniId to Moloni
      const localClients = await prisma.cliente.findMany({ where: { moloniId: null } });
      for (const c of localClients) {
        try {
          const result = await createMoloniCustomer(companyId, {
            name: c.nome,
            vat: c.nif || '999999990',
            email: c.email || undefined,
            phone: c.telefone || undefined,
            address: c.morada || undefined,
          });
          if (result.customer_id) {
            await prisma.cliente.update({
              where: { id: c.id },
              data: { moloniId: result.customer_id },
            });
            results.pushed++;
          } else {
            results.errors.push(`Cliente ${c.nome}: resposta inesperada`);
          }
        } catch (e: any) {
          results.errors.push(`Cliente ${c.nome}: ${e.message}`);
        }
      }
    }

    if (type === 'fornecedores') {
      const localSuppliers = await prisma.fornecedor.findMany({ where: { moloniId: null } });
      for (const s of localSuppliers) {
        try {
          const result = await createMoloniSupplier(companyId, {
            name: s.nome,
            vat: s.nif || '999999990',
            email: s.email || undefined,
            phone: s.telefone || undefined,
            address: s.morada || undefined,
          });
          if (result.supplier_id) {
            await prisma.fornecedor.update({
              where: { id: s.id },
              data: { moloniId: result.supplier_id },
            });
            results.pushed++;
          } else {
            results.errors.push(`Fornecedor ${s.nome}: resposta inesperada`);
          }
        } catch (e: any) {
          results.errors.push(`Fornecedor ${s.nome}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Moloni push error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar dados' }, { status: 500 });
  }
}
