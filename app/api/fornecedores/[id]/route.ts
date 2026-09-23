export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { nome, nif, email, telefone, morada, cidade, codigoPostal, website, contactoNome, contactoEmail, contactoTel, notas } = body ?? {};

    const fornecedor = await prisma.fornecedor.update({
      where: { id: params?.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(nif !== undefined && { nif: nif || null }),
        ...(email !== undefined && { email: email || null }),
        ...(telefone !== undefined && { telefone: telefone || null }),
        ...(morada !== undefined && { morada: morada || null }),
        ...(cidade !== undefined && { cidade: cidade || null }),
        ...(codigoPostal !== undefined && { codigoPostal: codigoPostal || null }),
        ...(website !== undefined && { website: website || null }),
        ...(contactoNome !== undefined && { contactoNome: contactoNome || null }),
        ...(contactoEmail !== undefined && { contactoEmail: contactoEmail || null }),
        ...(contactoTel !== undefined && { contactoTel: contactoTel || null }),
        ...(notas !== undefined && { notas: notas || null }),
        ...(body?.tipoFornecedor !== undefined && { tipoFornecedor: body.tipoFornecedor || null }),
      },
    });

    return NextResponse.json(fornecedor);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    await prisma.fornecedor.update({ where: { id: params?.id }, data: { ativo: false } });
    return NextResponse.json({ message: 'Fornecedor desativado' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
