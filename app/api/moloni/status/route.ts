export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getMoloniCompanyId, getMoloniCustomerCount, getMoloniSupplierCount, moloniRequest } from '@/lib/moloni';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const configured = !!(process.env.MOLONI_CLIENT_ID && process.env.MOLONI_CLIENT_SECRET && process.env.MOLONI_USERNAME && process.env.MOLONI_PASSWORD);

    if (!configured) {
      return NextResponse.json({ configured: false });
    }

    try {
      const companyId = await getMoloniCompanyId();

      // Get company name
      let companyName = '';
      try {
        const companyInfo = await moloniRequest('companies/getOne', { company_id: companyId });
        companyName = companyInfo?.name || '';
      } catch (e) {
        // Ignore - company name is optional
      }

      const [moloniCustomers, moloniSuppliers, localClients, localSuppliers, localFaturas] = await Promise.all([
        getMoloniCustomerCount(companyId),
        getMoloniSupplierCount(companyId),
        prisma.cliente.count(),
        prisma.fornecedor.count(),
        prisma.fatura.count(),
      ]);

      const localSyncedClients = await prisma.cliente.count({ where: { moloniId: { not: null } } });
      const localSyncedSuppliers = await prisma.fornecedor.count({ where: { moloniId: { not: null } } });
      const localSyncedFaturas = await prisma.fatura.count({ where: { moloniId: { not: null } } });

      return NextResponse.json({
        configured: true,
        connected: true,
        companyId,
        companyName,
        moloni: {
          clientes: moloniCustomers?.count ?? 0,
          fornecedores: moloniSuppliers?.count ?? 0,
        },
        local: {
          clientes: localClients,
          fornecedores: localSuppliers,
          faturas: localFaturas,
        },
        synced: {
          clientes: localSyncedClients,
          fornecedores: localSyncedSuppliers,
          faturas: localSyncedFaturas,
        },
      });
    } catch (e: any) {
      return NextResponse.json({ configured: true, connected: false, error: e.message });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
