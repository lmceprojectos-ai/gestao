export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

const BANK_KEYWORDS: Record<string, string[]> = {
  cgd: ['caixa geral', 'cgd', 'caixa geral de depositos', 'caixa geral de depósitos'],
  montepio: ['montepio', 'banco montepio', 'montepio geral'],
  bpi: ['bpi', 'banco bpi'],
  millennium: ['millennium', 'millenniumbcp', 'bcp'],
  santander: ['santander', 'banco santander'],
  novobanco: ['novo banco', 'novobanco'],
  bankinter: ['bankinter'],
  activobank: ['activo bank', 'activobank'],
};

const EMP_SOCIO_KEYWORDS = ['emp socio', 'emp socios', 'emp sócio', 'emp sócios', 'emprestimo socio', 'empréstimo sócio', 'emp. socio', 'emp. sócio'];

function detectEmprestimoSocio(descricao: string): boolean {
  const desc = descricao.toLowerCase().trim();
  return EMP_SOCIO_KEYWORDS.some(kw => desc.includes(kw));
}

function detectInterBankTransfer(descricao: string, importingBankName: string): string | null {
  const desc = descricao.toLowerCase();
  const importBank = importingBankName.toLowerCase();
  for (const [bankKey, keywords] of Object.entries(BANK_KEYWORDS)) {
    const isImportingBank = keywords.some(kw => importBank.includes(kw)) || importBank.includes(bankKey);
    if (isImportingBank) continue;
    if (keywords.some(kw => desc.includes(kw))) return bankKey;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const allContas = await prisma.contaBancaria.findMany({ where: { ativa: true } });
    const allMovimentos = await prisma.movimentoBancario.findMany({
      where: { reconciliado: false },
      include: { contaBancaria: true },
    });

    let converted = 0;
    let checked = 0;
    let emprestimos = 0;

    for (const mov of allMovimentos) {
      checked++;

      // Detect EMP SOCIO
      if (detectEmprestimoSocio(mov.descricao || '')) {
        const absValor = Math.abs(mov.valor);
        const existingEmp = await prisma.emprestimoSocio.findFirst({
          where: { valor: absValor, dataEmprestimo: mov.dataMovimento },
        });
        if (!existingEmp) {
          await prisma.$transaction([
            prisma.emprestimoSocio.create({
              data: {
                socioNome: 'Sócio',
                descricao: (mov.descricao || '').trim(),
                valor: absValor,
                dataEmprestimo: mov.dataMovimento,
                contaBancariaId: mov.contaBancariaId,
                estado: 'ativo',
              },
            }),
            prisma.movimentoBancario.delete({ where: { id: mov.id } }),
          ]);
          emprestimos++;
        }
        continue;
      }

      const bankName = ((mov.contaBancaria?.banco || '') + ' ' + (mov.contaBancaria?.nome || '')).trim();
      const otherBankKey = detectInterBankTransfer(mov.descricao || '', bankName);

      if (!otherBankKey) continue;

      const otherConta = allContas.find(c => {
        if (c.id === mov.contaBancariaId) return false;
        const otherName = ((c.banco || '') + ' ' + (c.nome || '')).toLowerCase();
        const keywords = BANK_KEYWORDS[otherBankKey] || [];
        return keywords.some(kw => otherName.includes(kw)) || otherName.includes(otherBankKey);
      });

      if (!otherConta) continue;

      const absValor = Math.abs(mov.valor);
      const isDebit = mov.tipo === 'debito';
      const contaOrigemId = isDebit ? mov.contaBancariaId : otherConta.id;
      const contaDestinoId = isDebit ? otherConta.id : mov.contaBancariaId;

      // Check for duplicate transfer
      const existingTransfer = await prisma.transferenciaInterna.findFirst({
        where: {
          valor: absValor,
          data: mov.dataMovimento,
          OR: [
            { contaOrigemId, contaDestinoId },
            { contaOrigemId: contaDestinoId, contaDestinoId: contaOrigemId },
          ],
        },
      });

      if (!existingTransfer) {
        await prisma.$transaction([
          prisma.transferenciaInterna.create({
            data: {
              descricao: (mov.descricao || 'Transferência interna').trim(),
              valor: absValor,
              data: mov.dataMovimento,
              contaOrigemId,
              contaDestinoId,
            },
          }),
          prisma.movimentoBancario.delete({ where: { id: mov.id } }),
        ]);
        converted++;
      }
    }

    return NextResponse.json({ success: true, checked, converted, emprestimos });
  } catch (error: any) {
    console.error('Detect transfers error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
