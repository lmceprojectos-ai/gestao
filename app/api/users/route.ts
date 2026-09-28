export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { effectivePontoRole } from '@/lib/ponto/roles';
import { sanitizePermissions } from '@/lib/permissions';

const ROLES = ['admin', 'editor', 'insercao', 'leitura', 'parceiro'];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const gRole = (session.user as any)?.role;
    if (gRole !== 'admin' && gRole !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLogin: true,
        createdAt: true,
        isPontoUser: true,
        pontoRole: true,
        parceiroId: true,
        sendToAccounting: true,
        partTime: true,
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const withPonto = users.map((u) => ({
      ...u,
      pontoEffectiveRole: u.isPontoUser ? effectivePontoRole(u.pontoRole, u.role) : null,
    }));
    return NextResponse.json(withPonto);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const gRole = (session.user as any)?.role;
    if (gRole !== 'admin' && gRole !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const body = await req.json();
    const { name, email, password, role } = body ?? {};
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e password são obrigatórios' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'A password deve ter pelo menos 6 caracteres' }, { status: 400 });
    }
    const finalRole = ROLES.includes(role) ? role : 'leitura';
    // Um editor não pode criar contas com perfil de administrador.
    if (gRole === 'editor' && finalRole === 'admin') {
      return NextResponse.json({ error: 'Sem permissão para criar contas de administrador. Contacte um administrador.' }, { status: 403 });
    }
    if (finalRole === 'parceiro' && !(body as any)?.parceiroId) {
      return NextResponse.json({ error: 'Escolha o parceiro a que esta conta pertence' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (existing) return NextResponse.json({ error: 'Este email já está registado' }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    // Só o administrador pode definir permissões personalizadas (e nunca para
    // contas de administrador, que têm sempre acesso total).
    const permsToSave = gRole === 'admin' && finalRole !== 'admin'
      ? sanitizePermissions((body as any)?.permissions)
      : null;
    const user = await prisma.user.create({
      data: {
        name, email: String(email).toLowerCase().trim(), password: hashed, role: finalRole, permissions: permsToSave,
        // Parceiros: parceiro a que o utilizador pertence (só vê a conta corrente desse parceiro).
        parceiroId: typeof (body as any)?.parceiroId === 'string' && (body as any).parceiroId ? (body as any).parceiroId : null,
      },
      select: { id: true, name: true, email: true, role: true, lastLogin: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar utilizador' }, { status: 500 });
  }
}
