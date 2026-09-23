export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Keywords that indicate an inter-bank transfer
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

// Keywords indicating shareholder loan deposits
const EMP_SOCIO_KEYWORDS = ['emp socio', 'emp socios', 'emp sócio', 'emp sócios', 'emprestimo socio', 'empréstimo sócio', 'emp. socio', 'emp. sócio'];

function detectEmprestimoSocio(descricao: string): boolean {
  const desc = descricao.toLowerCase().trim();
  return EMP_SOCIO_KEYWORDS.some(kw => desc.includes(kw));
}

function detectInterBankTransfer(descricao: string, importingBankName: string): string | null {
  const desc = descricao.toLowerCase();
  const importBank = importingBankName.toLowerCase();
  
  // Check if the description mentions a known bank that is NOT the importing bank
  for (const [bankKey, keywords] of Object.entries(BANK_KEYWORDS)) {
    // Skip if this bank matches the importing account's bank
    const isImportingBank = keywords.some(kw => importBank.includes(kw)) || importBank.includes(bankKey);
    if (isImportingBank) continue;
    
    // Check if the description mentions this other bank
    if (keywords.some(kw => desc.includes(kw))) {
      return bankKey;
    }
  }
  
  // Also detect generic transfer keywords combined with bank names
  const transferKeywords = ['transferencia', 'transferência', 'transf.', 'transf ', 'trf '];
  const hasTransferKeyword = transferKeywords.some(kw => desc.includes(kw));
  if (hasTransferKeyword) {
    for (const [bankKey, keywords] of Object.entries(BANK_KEYWORDS)) {
      const isImportingBank = keywords.some(kw => importBank.includes(kw)) || importBank.includes(bankKey);
      if (isImportingBank) continue;
      if (keywords.some(kw => desc.includes(kw))) {
        return bankKey;
      }
    }
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const operador = (session?.user as any)?.name || (session?.user as any)?.email || null;

    const body = await req.json();
    const { movimentos, contaBancariaId } = body ?? {};

    if (!contaBancariaId || !Array.isArray(movimentos) || movimentos.length === 0) {
      return NextResponse.json({ error: 'Conta bancária e movimentos são obrigatórios' }, { status: 400 });
    }

    // Verify account exists and get bank name
    const conta = await prisma.contaBancaria.findUnique({ where: { id: contaBancariaId } });
    if (!conta) {
      return NextResponse.json({ error: 'Conta bancária não encontrada' }, { status: 404 });
    }

    // Get all bank accounts to try matching inter-bank transfers
    const allContas = await prisma.contaBancaria.findMany({ where: { ativa: true } });

    let created = 0;
    let skipped = 0;
    let transferencias = 0;

    for (const mov of movimentos) {
      try {
        const { descricao, valor, dataMovimento, tipo } = mov;
        if (!descricao || valor === undefined || !dataMovimento || !tipo) {
          skipped++;
          continue;
        }

        // Check for duplicate (same date, value, description)
        const existing = await prisma.movimentoBancario.findFirst({
          where: {
            contaBancariaId,
            descricao: descricao.trim(),
            valor: Math.abs(Number(valor)),
            dataMovimento: new Date(dataMovimento),
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Detect shareholder loans (EMP SOCIO)
        if (detectEmprestimoSocio(descricao)) {
          const absValor = Math.abs(Number(valor));
          // Check for duplicate
          const existingEmp = await prisma.emprestimoSocio.findFirst({
            where: {
              valor: absValor,
              dataEmprestimo: new Date(dataMovimento),
              descricao: descricao.trim(),
            },
          });
          if (!existingEmp) {
            await prisma.emprestimoSocio.create({
              data: {
                socioNome: 'Sócio',
                descricao: descricao.trim(),
                valor: absValor,
                dataEmprestimo: new Date(dataMovimento),
                contaBancariaId,
                estado: 'ativo',
                criadoPor: operador,
              },
            });
          }
          skipped++;
          continue;
        }

        // Detect inter-bank transfers
        const bankName = (conta.banco || '') + ' ' + (conta.nome || '');
        const otherBankKey = detectInterBankTransfer(descricao, bankName);
        
        if (otherBankKey) {
          // Try to find the other bank account
          const otherConta = allContas.find(c => {
            if (c.id === contaBancariaId) return false;
            const otherName = ((c.banco || '') + ' ' + (c.nome || '')).toLowerCase();
            const keywords = BANK_KEYWORDS[otherBankKey] || [];
            return keywords.some(kw => otherName.includes(kw)) || otherName.includes(otherBankKey);
          });

          if (otherConta) {
            // It's an inter-bank transfer - create TransferenciaInterna instead
            const absValor = Math.abs(Number(valor));
            const isDebit = tipo === 'debito';
            const contaOrigemId = isDebit ? contaBancariaId : otherConta.id;
            const contaDestinoId = isDebit ? otherConta.id : contaBancariaId;

            // Check for duplicate transfer
            const existingTransfer = await prisma.transferenciaInterna.findFirst({
              where: {
                valor: absValor,
                data: new Date(dataMovimento),
                OR: [
                  { contaOrigemId, contaDestinoId },
                  { contaOrigemId: contaDestinoId, contaDestinoId: contaOrigemId },
                ],
              },
            });

            if (!existingTransfer) {
              await prisma.transferenciaInterna.create({
                data: {
                  descricao: descricao.trim(),
                  valor: absValor,
                  data: new Date(dataMovimento),
                  contaOrigemId,
                  contaDestinoId,
                  criadoPor: operador,
                },
              });
              transferencias++;
            } else {
              skipped++;
            }
            continue;
          }
        }

        // Regular movement
        await prisma.movimentoBancario.create({
          data: {
            descricao: descricao.trim(),
            valor: Math.abs(Number(valor)),
            dataMovimento: new Date(dataMovimento),
            tipo,
            contaBancariaId,
            criadoPor: operador,
          },
        });
        created++;
      } catch (err) {
        console.error('Error creating movement:', err);
        skipped++;
      }
    }

    return NextResponse.json({ success: true, created, skipped, transferencias, total: movimentos.length });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Erro na importação' }, { status: 500 });
  }
}
