export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Atualiza os dados extraídos (edição manual) ou o estado (ex: ignorar).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const data: any = {};
  if (body.dadosExtraidos !== undefined) data.dadosExtraidos = body.dadosExtraidos;
  if (body.estado !== undefined) {
    const permitidos = ['por_confirmar', 'ignorado', 'duplicado'];
    if (!permitidos.includes(body.estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }
    data.estado = body.estado;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  const atualizado = await prisma.digitalizacaoImportada.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(atualizado);
}

// Remove um registo de importação (não apaga o registo real já criado, se existir).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await prisma.digitalizacaoImportada.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
