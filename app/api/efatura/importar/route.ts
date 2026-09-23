export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { parseEFatura } from '@/lib/efatura/parse';

// Importa o Excel do e-Fatura. Pode ser importado várias vezes: documentos já
// existentes (mesmo NIF + número) são atualizados, os restantes são criados.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 });
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json({ error: 'Envie o ficheiro Excel exportado do e-Fatura (.xlsx)' }, { status: 400 });
    }

    let linhas;
    let ignoradas = 0;
    try {
      ({ linhas, ignoradas } = parseEFatura(Buffer.from(await file.arrayBuffer())));
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Não foi possível ler o ficheiro' }, { status: 400 });
    }
    if (linhas.length === 0) return NextResponse.json({ error: 'O ficheiro não tem documentos' }, { status: 400 });

    const importadoPor = (session.user as any)?.name || (session.user as any)?.email || null;
    const existentes = await prisma.eFaturaDocumento.findMany({
      where: { OR: linhas.map((l) => ({ emitenteNif: l.emitenteNif, numero: l.numero })) },
      select: { emitenteNif: true, numero: true },
    });
    const jaExiste = new Set(existentes.map((e) => `${e.emitenteNif}|${e.numero}`));

    // Os documentos vêm do Excel; 'ignorado' e 'nota' (decisões do utilizador) mantêm-se.
    await prisma.$transaction(
      linhas.map((l) => {
        const dados = {
          mes: l.dataEmissao.slice(0, 7),
          setor: l.setor,
          emitenteNome: l.emitenteNome,
          atcud: l.atcud,
          tipo: l.tipo,
          dataEmissao: new Date(`${l.dataEmissao}T12:00:00Z`),
          total: l.total,
          iva: l.iva,
          base: l.base,
          situacao: l.situacao,
          ficheiro: file.name,
          importadoPor,
        };
        return prisma.eFaturaDocumento.upsert({
          where: { emitenteNif_numero: { emitenteNif: l.emitenteNif, numero: l.numero } },
          create: { emitenteNif: l.emitenteNif, numero: l.numero, ...dados },
          update: dados,
        });
      })
    );

    const novos = linhas.filter((l) => !jaExiste.has(`${l.emitenteNif}|${l.numero}`)).length;
    const meses = [...new Set(linhas.map((l) => l.dataEmissao.slice(0, 7)))].sort();
    return NextResponse.json({ success: true, total: linhas.length, novos, atualizados: linhas.length - novos, ignoradas, meses });
  } catch (error: any) {
    console.error('efatura importar error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao importar' }, { status: 500 });
  }
}
