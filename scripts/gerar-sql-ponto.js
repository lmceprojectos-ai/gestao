// Gera um SQL (MySQL/MariaDB) a partir da exportação JSON do módulo de ponto da Abacus.
// Uso: node scripts/gerar-sql-ponto.js <Gestao_Ponto_Export.json> <saida.sql>
// Substitui os dados das tabelas do ponto e atualiza/cria as contas dos colaboradores.
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const [, , inPath, outPath] = process.argv;
const d = JSON.parse(fs.readFileSync(inPath, 'utf8'));

// Só se importam registos de contas incluídas na exportação (a chave estrangeira
// para User rejeita o resto). Em campos opcionais, a ligação fica a NULL.
const userIds = new Set(d.colaboradores.map((u) => u.id));
const skipped = [];
function ownedByKnownUser(name, rows) {
  const ok = rows.filter((r) => userIds.has(r.userId));
  if (ok.length < rows.length) skipped.push(`${name}: ${rows.length - ok.length}`);
  return ok;
}
for (const r of [...d.funcoes.perfisSalariais, ...d.funcoes.recibos]) {
  if (r.userId && !userIds.has(r.userId)) r.userId = null;
}
d.calendario.registosPonto = ownedByKnownUser('registos de ponto', d.calendario.registosPonto);
d.calendario.faltas = ownedByKnownUser('faltas', d.calendario.faltas);
d.calendario.ferias = ownedByKnownUser('férias', d.calendario.ferias);
d.calendario.diasSemTarefas = ownedByKnownUser('dias sem tarefas', d.calendario.diasSemTarefas);
d.fichas = ownedByKnownUser('fichas', d.fichas);

function dt(v) {
  if (!v) return 'NULL';
  const s = new Date(v).toISOString(); // UTC, como o Prisma grava
  return `'${s.slice(0, 10)} ${s.slice(11, 23)}'`;
}
function str(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function num(v) {
  return v === null || v === undefined ? 'NULL' : String(Number(v));
}
function bool(v) {
  return v === null || v === undefined ? 'NULL' : v ? '1' : '0';
}
function json(v) {
  return v === null || v === undefined ? 'NULL' : str(JSON.stringify(v));
}

function insert(table, rows, cols) {
  if (!rows.length) return '';
  const names = Object.keys(cols);
  const values = rows.map((r) => `(${names.map((c) => cols[c](r)).join(', ')})`);
  return `INSERT INTO \`${table}\` (${names.map((c) => `\`${c}\``).join(', ')}) VALUES\n${values.join(',\n')};\n`;
}

const out = [];
out.push(`-- Dados do módulo de ponto importados da Abacus (${d._meta.geradoEm})`);
out.push('SET NAMES utf8mb4;');
out.push('SET FOREIGN_KEY_CHECKS=0;');
out.push('START TRANSACTION;');

// Contas dos colaboradores: se já existir uma conta com o mesmo email mas outro id,
// passa a usar o id da Abacus (as relações seguem por ON UPDATE CASCADE).
// Contas novas ficam com uma palavra-passe aleatória: repor em "Esqueci-me da palavra-passe"
// ou pelo administrador na gestão de utilizadores.
for (const u of d.colaboradores) {
  const placeholder = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  out.push(`UPDATE \`User\` SET \`id\` = ${str(u.id)} WHERE \`email\` = ${str(u.email)} AND \`id\` <> ${str(u.id)};`);
  out.push(
    `INSERT INTO \`User\` (\`id\`, \`name\`, \`email\`, \`password\`, \`role\`, \`lastLogin\`, \`createdAt\`, \`updatedAt\`, \`iban\`, \`active\`, \`sendToAccounting\`, \`partTime\`, \`isPontoUser\`, \`pontoRole\`, \`permissions\`) VALUES ` +
      `(${str(u.id)}, ${str(u.name)}, ${str(u.email)}, ${str(placeholder)}, ${str(u.role)}, ${dt(u.lastLogin)}, ${dt(u.createdAt)}, ${dt(u.updatedAt)}, ${str(u.iban)}, ${bool(u.active)}, ${bool(u.sendToAccounting)}, ${bool(u.partTime)}, ${bool(u.isPontoUser)}, ${str(u.pontoRole)}, ${str(u.permissions)}) ` +
      `ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`role\` = VALUES(\`role\`), \`iban\` = VALUES(\`iban\`), \`active\` = VALUES(\`active\`), \`sendToAccounting\` = VALUES(\`sendToAccounting\`), \`partTime\` = VALUES(\`partTime\`), \`isPontoUser\` = VALUES(\`isPontoUser\`), \`pontoRole\` = VALUES(\`pontoRole\`), \`permissions\` = VALUES(\`permissions\`), \`updatedAt\` = VALUES(\`updatedAt\`);`
  );
}

// Tabelas exclusivas do ponto: substituir tudo.
for (const t of ['TimeRecord', 'Absence', 'VacationRequest', 'DailyTaskMiss', 'Payslip', 'SalaryProfile', 'ClientDocument', 'ClientFile', 'AllowedIp']) {
  out.push(`DELETE FROM \`${t}\`;`);
}

const cal = d.calendario;
out.push(insert('TimeRecord', cal.registosPonto, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), type: (r) => str(r.type), timestamp: (r) => dt(r.timestamp),
  workDate: (r) => str(r.workDate), ipAddress: (r) => str(r.ipAddress), device: (r) => str(r.device),
  lateMinutes: (r) => num(r.lateMinutes ?? 0), extraMinutes: (r) => num(r.extraMinutes ?? 0), correctedBy: (r) => str(r.correctedBy),
  note: (r) => str(r.note), delayReason: (r) => str(r.delayReason), createdAt: (r) => dt(r.createdAt),
}));
out.push(insert('Absence', cal.faltas, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), absenceDate: (r) => str(r.absenceDate), status: (r) => str(r.status),
  reason: (r) => str(r.reason), observation: (r) => str(r.observation), attachmentPath: (r) => str(r.attachmentPath),
  attachmentName: (r) => str(r.attachmentName), attachmentPublic: (r) => bool(r.attachmentPublic ?? false),
  decisionNote: (r) => str(r.decisionNote), decidedBy: (r) => str(r.decidedBy), decidedAt: (r) => dt(r.decidedAt),
  createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
out.push(insert('VacationRequest', cal.ferias, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), startDate: (r) => str(r.startDate), endDate: (r) => str(r.endDate),
  days: (r) => num(r.days ?? 0), reason: (r) => str(r.reason), status: (r) => str(r.status), decisionNote: (r) => str(r.decisionNote),
  decidedBy: (r) => str(r.decidedBy), decidedAt: (r) => dt(r.decidedAt), createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
out.push(insert('DailyTaskMiss', cal.diasSemTarefas, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), missDate: (r) => str(r.missDate), note: (r) => str(r.note),
  markedBy: (r) => str(r.markedBy), createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
out.push(insert('SalaryProfile', d.funcoes.perfisSalariais, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), name: (r) => str(r.name), employeeNumber: (r) => str(r.employeeNumber),
  category: (r) => str(r.category), vencimentoBase: (r) => num(r.vencimentoBase ?? 0), periodRate: (r) => num(r.periodRate ?? 0),
  mealPerDay: (r) => num(r.mealPerDay ?? 0), subsFerias: (r) => num(r.subsFerias ?? 0), subsNatal: (r) => num(r.subsNatal ?? 0),
  ssRate: (r) => num(r.ssRate ?? 0.11), irsRate: (r) => num(r.irsRate ?? 0), nif: (r) => str(r.nif), numSegSocial: (r) => str(r.numSegSocial),
  morada: (r) => str(r.morada), refMonth: (r) => str(r.refMonth), refData: (r) => json(r.refData),
  createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
const payslipNum = ['salarioBase', 'vencimentoBase', 'subsAlimentacao', 'subsFerias', 'subsNatal', 'outrosAbonos', 'totalFaltas', 'segSocial', 'irs', 'outrosDescontos', 'totalIliquido', 'totalDescontos', 'liquido', 'workingDays', 'daysWorked', 'absJustDays', 'absInjustDays', 'feriasDays', 'premioAssiduidade'];
out.push(insert('Payslip', d.funcoes.recibos, {
  id: (r) => str(r.id), month: (r) => str(r.month), userId: (r) => str(r.userId), employeeNumber: (r) => str(r.employeeNumber),
  name: (r) => str(r.name), category: (r) => str(r.category),
  ...Object.fromEntries(payslipNum.map((k) => [k, (r) => num(r[k] ?? 0)])),
  premioQualificado: (r) => bool(r.premioQualificado ?? false), autoGenerated: (r) => bool(r.autoGenerated ?? true),
  breakdown: (r) => json(r.breakdown), createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
out.push(insert('ClientFile', d.fichas, {
  id: (r) => str(r.id), userId: (r) => str(r.userId), fullName: (r) => str(r.fullName), address: (r) => str(r.address),
  phone: (r) => str(r.phone), nif: (r) => str(r.nif), notes: (r) => str(r.notes), createdAt: (r) => dt(r.createdAt), updatedAt: (r) => dt(r.updatedAt),
}));
const docs = d.fichas.flatMap((f) => (f.documents || []).map((doc) => ({ ...doc, clientFileId: f.id })));
out.push(insert('ClientDocument', docs, {
  id: (r) => str(r.id), clientFileId: (r) => str(r.clientFileId), label: (r) => str(r.label), category: (r) => str(r.category),
  side: (r) => str(r.side), cloud_storage_path: (r) => str(r.cloud_storage_path), fileName: (r) => str(r.fileName),
  contentType: (r) => str(r.contentType || 'application/octet-stream'), uploadedBy: (r) => str(r.uploadedBy || 'importacao-abacus'),
  createdAt: (r) => dt(r.createdAt),
}));
out.push(insert('AllowedIp', d.ipsPermitidos, {
  id: (r) => str(r.id), address: (r) => str(r.address), label: (r) => str(r.label), createdAt: (r) => dt(r.createdAt),
}));

// Definições: só as chaves exportadas.
if (d.definicoes.length) {
  out.push(`DELETE FROM \`Setting\` WHERE \`key\` IN (${d.definicoes.map((s) => str(s.key)).join(', ')});`);
  out.push(insert('Setting', d.definicoes, {
    id: (r) => str(r.id), key: (r) => str(r.key), value: (r) => str(r.value), updatedAt: (r) => dt(r.updatedAt),
  }));
}

out.push('COMMIT;');
out.push('SET FOREIGN_KEY_CHECKS=1;');
fs.writeFileSync(outPath, out.filter(Boolean).join('\n') + '\n');
console.log(`SQL gerado: ${outPath}`);
if (skipped.length) console.log(`Ignorados (conta não exportada): ${skipped.join('; ')}`);
