export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sanitizePermissions } from '@/lib/permissions';

const ROLES = ['admin', 'editor', 'insercao', 'leitura', 'parceiro'];
const EMPRESAS_PARCEIRAS = ['CRIACONSENSOS', 'RECLAMARTE'];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const gRole = (session.user as any)?.role;
    if (gRole !== 'admin' && gRole !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const body = await req.json();
    const { name, email, password, role } = body ?? {};
    const hasPermissions = body && Object.prototype.hasOwnProperty.call(body, 'permissions');

    // Salvaguardas para o perfil de editor: não pode mexer em contas de
    // administrador nem promover contas a administrador.
    if (gRole === 'editor') {
      const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
      if (target?.role === 'admin') {
        return NextResponse.json({ error: 'Sem permissão para alterar contas de administrador. Contacte um administrador.' }, { status: 403 });
      }
      if (role === 'admin') {
        return NextResponse.json({ error: 'Sem permissão para atribuir o perfil de administrador. Contacte um administrador.' }, { status: 403 });
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = String(email).toLowerCase().trim();
    if (role !== undefined && ROLES.includes(role)) data.role = role;
    // Parceiros: empresa parceira do utilizador (a conta "parceiro" fica sempre com uma).
    if (body && 'parceiroEmpresa' in body) {
      data.parceiroEmpresa = EMPRESAS_PARCEIRAS.includes(body.parceiroEmpresa) ? body.parceiroEmpresa : null;
    }
    if (data.role === 'parceiro' && !data.parceiroEmpresa) data.parceiroEmpresa = 'RECLAMARTE';
    if (password) {
      if (String(password).length < 6) return NextResponse.json({ error: 'A password deve ter pelo menos 6 caracteres' }, { status: 400 });
      data.password = await bcrypt.hash(password, 12);
    }

    // Permissões personalizadas: apenas o administrador as pode definir. Contas
    // de administrador têm sempre acesso total, por isso guardam sempre null.
    if (hasPermissions && gRole === 'admin') {
      const targetRole = (role !== undefined && ROLES.includes(role))
        ? role
        : (await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } }))?.role;
      data.permissions = targetRole === 'admin' ? null : sanitizePermissions((body as any).permissions);
    }
    // Se o perfil for alterado PARA administrador, limpar quaisquer permissões
    // personalizadas (o admin tem sempre acesso total).
    if (data.role === 'admin') {
      data.permissions = null;
    }

    // Impedir que o próprio admin remova o seu perfil de administrador (evita ficar sem admins)
    if (params.id === (session.user as any)?.id && data.role && data.role !== 'admin') {
      return NextResponse.json({ error: 'Não pode alterar o seu próprio perfil de administrador' }, { status: 400 });
    }

    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== params.id) return NextResponse.json({ error: 'Este email já está registado' }, { status: 409 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, lastLogin: true, createdAt: true },
    });
    return NextResponse.json(user);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar utilizador' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const gRole = (session.user as any)?.role;
    if (gRole !== 'admin' && gRole !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    if (params.id === (session.user as any)?.id) {
      return NextResponse.json({ error: 'Não pode eliminar o seu próprio utilizador' }, { status: 400 });
    }
    // O editor pode eliminar contas de administrador (por decisão do administrador).
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao eliminar utilizador' }, { status: 500 });
  }
}
