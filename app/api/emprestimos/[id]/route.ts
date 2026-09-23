export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const item = await prisma.emprestimoSocio.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    let url = null;
    if (item.cloudStoragePath) {
      url = await getFileUrl(item.cloudStoragePath, item.contentType || 'image/jpeg', false);
    }
    return NextResponse.json({ ...item, url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { socioNome, descricao, valor, dataEmprestimo, contaBancariaId, notas, estado, cloudStoragePath, contentType, nomeOriginal } = body ?? {};

    const data: any = {};
    if (socioNome !== undefined) data.socioNome = socioNome;
    if (descricao !== undefined) data.descricao = descricao || null;
    if (valor !== undefined) data.valor = parseFloat(valor);
    if (dataEmprestimo !== undefined) data.dataEmprestimo = new Date(dataEmprestimo);
    if (contaBancariaId !== undefined) data.contaBancariaId = contaBancariaId || null;
    if (notas !== undefined) data.notas = notas || null;
    if (estado !== undefined) data.estado = estado;
    if (cloudStoragePath !== undefined) data.cloudStoragePath = cloudStoragePath || null;
    if (contentType !== undefined) data.contentType = contentType || null;
    if (nomeOriginal !== undefined) data.nomeOriginal = nomeOriginal || null;

    const emprestimo = await prisma.emprestimoSocio.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(emprestimo);
  } catch (error: any) {
    console.error('Empréstimo PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    await prisma.emprestimoSocio.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Empréstimo eliminado' });
  } catch (error: any) {
    console.error('Empréstimo DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
