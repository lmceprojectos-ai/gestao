import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const faturas = await prisma.fatura.findMany({ where: { origem: null } });
  let cliente = 0, fornecedor = 0;
  for (const f of faturas) {
    let origem: string;
    if (f.tipo === 'emitida') origem = 'cliente';
    else if (f.tipo === 'recebida') origem = 'fornecedor';
    else if (f.clienteId) origem = 'cliente';
    else if (f.fornecedorId) origem = 'fornecedor';
    else origem = 'cliente'; // fallback (Moloni sales docs)
    await prisma.fatura.update({ where: { id: f.id }, data: { origem } });
    if (origem === 'cliente') cliente++; else fornecedor++;
  }
  console.log(`Backfill concluído: ${faturas.length} atualizados (cliente=${cliente}, fornecedor=${fornecedor})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
