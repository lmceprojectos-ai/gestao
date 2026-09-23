import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('johndoe123', 12);
  
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Administrador',
      password: hashedPassword,
      role: 'admin',
    },
  });

  // Configurações padrão (formas de pagamento, tipos de documento, estados)
  const configs: { grupo: string; valor: string; label: string; cor?: string; ordem: number }[] = [
    // Formas de pagamento
    { grupo: 'forma_pagamento', valor: 'transferencia', label: 'Transferência', ordem: 1 },
    { grupo: 'forma_pagamento', valor: 'multibanco', label: 'Multibanco', ordem: 2 },
    { grupo: 'forma_pagamento', valor: 'mbway', label: 'MB WAY', ordem: 3 },
    { grupo: 'forma_pagamento', valor: 'debito_direto', label: 'Débito Direto', ordem: 4 },
    { grupo: 'forma_pagamento', valor: 'cheque', label: 'Cheque', ordem: 5 },
    { grupo: 'forma_pagamento', valor: 'numerario', label: 'Numerário', ordem: 6 },
    { grupo: 'forma_pagamento', valor: 'cartao', label: 'Cartão', ordem: 7 },
    { grupo: 'forma_pagamento', valor: 'outro', label: 'Outro', ordem: 8 },
    // Tipos de documento
    { grupo: 'tipo_documento', valor: 'recebida', label: 'Fatura de Fornecedor', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', ordem: 1 },
    { grupo: 'tipo_documento', valor: 'emitida', label: 'Fatura Emitida', cor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', ordem: 2 },
    { grupo: 'tipo_documento', valor: 'nota_credito', label: 'Nota de Crédito', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', ordem: 3 },
    { grupo: 'tipo_documento', valor: 'nota_debito', label: 'Nota de Débito', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', ordem: 4 },
    { grupo: 'tipo_documento', valor: 'orcamento', label: 'Orçamento', cor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', ordem: 5 },
    { grupo: 'tipo_documento', valor: 'recibo', label: 'Recibo', cor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', ordem: 5 },
    { grupo: 'tipo_documento', valor: 'guia', label: 'Guia', cor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', ordem: 6 },
    // Estados
    { grupo: 'estado', valor: 'pendente', label: 'Pendente', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', ordem: 1 },
    { grupo: 'estado', valor: 'pago', label: 'Pago', cor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', ordem: 2 },
    { grupo: 'estado', valor: 'parcial', label: 'Parcial', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', ordem: 3 },
    { grupo: 'estado', valor: 'cancelado', label: 'Cancelado', cor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', ordem: 4 },
  ];

  for (const c of configs) {
    await prisma.configuracao.upsert({
      where: { grupo_valor: { grupo: c.grupo, valor: c.valor } },
      update: { label: c.label, cor: c.cor, ordem: c.ordem },
      create: c,
    });
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
