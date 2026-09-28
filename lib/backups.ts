// Cópias de segurança: ficheiros JSON guardados no servidor, em
// LOCAL_UPLOADS_DIR/backups (fora da pasta da app, não se perdem num deploy),
// com o registo na tabela Backup. Só os administradores lhes têm acesso.
import { prisma } from '@/lib/db';
import { writeLocalFile, readLocalFile } from '@/lib/local-storage';

export function soAdmin(session: any) {
  return !!session && (session.user as any)?.role === 'admin';
}

export async function listarBackups() {
  const lista = await prisma.backup.findMany({ orderBy: { createdAt: 'desc' } });
  return lista.map((b) => ({ ...b, balancete: b.origem?.includes('balancete') ?? false }));
}

export async function guardarBackup({ nome, descricao, origem, conteudo, criadoPor }: {
  nome: string; descricao?: string | null; origem?: string | null; conteudo: Buffer; criadoPor?: string | null;
}) {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const base = nome.replace(/\.json$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'backup';
  const ficheiro = `backups/${carimbo}-${base}.json`;
  writeLocalFile(ficheiro, conteudo);
  return prisma.backup.create({
    data: { nome, descricao: descricao ?? null, origem: origem ?? null, ficheiro, tamanho: conteudo.length, criadoPor: criadoPor ?? null },
  });
}

export async function lerBackup(id: string) {
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return null;
  return { backup, conteudo: readLocalFile(backup.ficheiro) };
}

// Cópia de todos os dados da app (todas as tabelas) num único JSON.
// Não entram segredos: palavras-passe, códigos de recuperação e credenciais de redes sociais.
export async function backupDaApp() {
  const { Prisma } = await import('@prisma/client');
  const tabelas: Record<string, unknown[]> = {};
  const SEM_COPIA = new Set(['PasswordResetToken', 'PontoPasswordResetToken']);
  for (const m of Prisma.dmmf.datamodel.models) {
    const delegado = (prisma as any)[m.name.charAt(0).toLowerCase() + m.name.slice(1)];
    if (!delegado?.findMany || SEM_COPIA.has(m.name)) continue;
    const linhas: any[] = await delegado.findMany();
    tabelas[m.name] =
      m.name === 'User' ? linhas.map(({ password, pontoPin, ...resto }) => resto)
      : m.name === 'SocialConnection' ? linhas.map(({ credenciais, ...resto }) => resto)
      : linhas;
  }
  return { formato: 'app-gestao-backup-v1', criadoEm: new Date().toISOString(), tabelas };
}
