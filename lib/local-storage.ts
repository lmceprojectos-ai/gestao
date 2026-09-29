import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Armazenamento de ficheiros no disco do servidor.
// A pasta pode ser definida em LOCAL_UPLOADS_DIR — convém ficar FORA da pasta da
// aplicação no cPanel, para que um novo deploy nunca apague os documentos.
export const LOCAL_UPLOADS_ROOT = path.resolve(
  process.env.LOCAL_UPLOADS_DIR || path.join(process.cwd(), '.local-uploads')
);

// Os links para ficheiros privados são assinados e expiram (como os URLs
// assinados do S3). Ficheiros sob ".../public/" são servidos sem assinatura.
const LINK_TTL_SECONDS = 3600;

export function resolveLocalPath(key: string): string {
  const full = path.resolve(LOCAL_UPLOADS_ROOT, key.replace(/^[/\\]+/, ''));
  if (full !== LOCAL_UPLOADS_ROOT && !full.startsWith(LOCAL_UPLOADS_ROOT + path.sep)) {
    throw new Error('Caminho de ficheiro inválido.');
  }
  return full;
}

export function isPublicKey(key: string): boolean {
  return key.startsWith('public/') || key.includes('/public/');
}

export function writeLocalFile(key: string, data: Buffer) {
  const full = resolveLocalPath(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

export function readLocalFile(key: string): Buffer {
  return fs.readFileSync(resolveLocalPath(key));
}

export function deleteLocalFile(key: string) {
  fs.rm(resolveLocalPath(key), { force: true }, () => {});
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET não definido.');
  return s;
}

function sign(action: 'get' | 'put', key: string, exp: number): string {
  return crypto.createHmac('sha256', secret()).update(`${action}\n${key}\n${exp}`).digest('hex');
}

export function signedQuery(action: 'get' | 'put', key: string): string {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  return `exp=${exp}&sig=${sign(action, key, exp)}`;
}

export function verifySignature(action: 'get' | 'put', key: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(action, key, expNum), 'hex');
  const given = Buffer.from(sig, 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// URL base absoluta da app (necessária quando o link sai da app: emails, IA, WhatsApp).
export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
}

export function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
