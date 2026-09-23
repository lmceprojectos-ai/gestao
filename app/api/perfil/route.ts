export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Perfil privado do utilizador. Cada utilizador gere APENAS o seu perfil.
// Devolve tambem a lista de nomes de funcionarios (dos vencimentos) para o seletor
// e os vencimentos do funcionario associado ao perfil (para a checklist do IRS).

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

    const perfil = await prisma.perfilFuncionario.findUnique({ where: { userId } });

    // Nomes distintos de funcionarios existentes nos vencimentos (para o seletor).
    const vencs = await prisma.vencimento.findMany({ select: { funcionario: true } });
    const funcionarios = Array.from(new Set(vencs.map(v => (v.funcionario || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt'));

    // Vencimentos do funcionario associado ao perfil (se definido).
    let vencimentos: any[] = [];
    if (perfil?.funcionarioVencimento) {
      const alvo = perfil.funcionarioVencimento.trim();
      vencimentos = await prisma.vencimento.findMany({
        where: { funcionario: alvo },
        select: { id: true, funcionario: true, cargo: true, valorBruto: true, valorLiquido: true, segSocial: true, irs: true, periodo: true, dataPagamento: true },
        orderBy: { periodo: 'desc' },
      });
    }

    return NextResponse.json({ perfil, funcionarios, vencimentos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    const body = await req.json();

    const dataNascimento = body.dataNascimento ? new Date(body.dataNascimento) : null;
    const payload = {
      nomeCompleto: body.nomeCompleto || null,
      numero: body.numero || null,
      email: body.email || null,
      morada: body.morada || null,
      dataNascimento,
      funcionarioVencimento: body.funcionarioVencimento || null,
    };

    const perfil = await prisma.perfilFuncionario.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
    return NextResponse.json(perfil);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
