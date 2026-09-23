// Prepara a exportação financeira da Abacus (só INSERTs) para importar por cima da base
// de dados existente no cPanel: apaga primeiro os dados financeiros antigos e atualiza as
// contas (User) sem as apagar, para não afetar os dados do módulo de ponto.
// Uso: node scripts/gerar-sql-financeiro.js <export.sql> <saida.sql>
const fs = require('fs');

const [, , inPath, outPath] = process.argv;
const src = fs.readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n');

// Blocos "-- ---------- Tabela (N registos) ----------" seguidos de um INSERT multi-linha.
const tables = [...src.matchAll(/^-- -+ (\w+) \(\d+ registos\) -+$/gm)].map((m) => m[1]);
const financeTables = tables.filter((t) => t !== 'User');

// Colunas do INSERT de User, para montar o ON DUPLICATE KEY UPDATE.
const userInsert = src.match(/^INSERT INTO `User` \(([^)]+)\) VALUES$/m);
if (!userInsert) throw new Error('INSERT de User não encontrado.');
const userCols = userInsert[1].split(',').map((c) => c.trim().replace(/`/g, ''));
const updateSet = userCols
  .filter((c) => c !== 'id' && c !== 'email')
  .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
  .join(', ');

// O INSERT de User termina na primeira linha acabada em ");" depois do cabeçalho.
const start = src.indexOf(userInsert[0]);
const end = src.indexOf(');\n', start) + 1;
let body = src.slice(0, end) + `\nON DUPLICATE KEY UPDATE ${updateSet};\n` + src.slice(end + 2);

// Remover o SET FOREIGN_KEY_CHECKS=1 final: é reposto depois do COMMIT.
body = body.replace(/\nSET FOREIGN_KEY_CHECKS=1;\s*$/, '\n');

// IDs das contas exportadas (primeira coluna de cada linha do bloco User).
const userBlock = src.slice(start, end);
const userIds = [...userBlock.matchAll(/^\('([^']+)'/gm)].map((m) => m[1]);

const header = [
  `-- Importação da gestão financeira (Abacus) sobre a base de dados do cPanel`,
  `-- Tabelas substituídas: ${financeTables.join(', ')}`,
  `-- Contas atualizadas (sem apagar): ${userIds.length}`,
  '/*!40101 SET NAMES utf8mb4 */;',
  'SET FOREIGN_KEY_CHECKS=0;',
  'START TRANSACTION;',
  ...financeTables.map((t) => `DELETE FROM \`${t}\`;`),
  '',
].join('\n');

// Contas que já não existem na Abacus (restos de testes de julho). Só se removem as que
// não têm dados do ponto associados.
const footer = [
  '',
  `DELETE FROM \`User\` WHERE \`id\` NOT IN (${userIds.map((id) => `'${id}'`).join(', ')})`,
  '  AND `id` NOT IN (SELECT `userId` FROM `TimeRecord`)',
  '  AND `id` NOT IN (SELECT `userId` FROM `ClientFile`);',
  'COMMIT;',
  'SET FOREIGN_KEY_CHECKS=1;',
  '',
].join('\n');

// O cabeçalho original da exportação (SET NAMES / FOREIGN_KEY_CHECKS) é mantido; é inofensivo.
fs.writeFileSync(outPath, header + body + footer);
console.log(`SQL gerado: ${outPath}`);
console.log(`Tabelas financeiras: ${financeTables.length}; contas: ${userIds.join(', ')}`);
