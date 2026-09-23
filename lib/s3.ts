// Armazenamento de ficheiros. Mantém a interface original (antes S3 da Abacus),
// mas grava no disco do servidor — ver lib/local-storage.ts.
import {
  appBaseUrl,
  deleteLocalFile,
  encodeKey,
  isPublicKey,
  readLocalFile,
  signedQuery,
  writeLocalFile,
} from './local-storage';

function shouldServeInline(contentType: string): boolean {
  return (
    (contentType.startsWith('image/') && contentType !== 'image/svg+xml') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    contentType === 'application/pdf'
  );
}

function newKey(fileName: string, isPublic: boolean) {
  const folderPrefix = process.env.AWS_FOLDER_PREFIX ?? '';
  const prefix = isPublic ? `${folderPrefix}public/uploads` : `${folderPrefix}uploads`;
  const safeName = (fileName || 'ficheiro').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${Date.now()}-${safeName}`;
}

export async function generatePresignedUploadUrl(
  fileName: string,
  _contentType: string,
  isPublic: boolean = false
) {
  const cloud_storage_path = newKey(fileName, isPublic);
  const uploadUrl = `/api/local-storage/upload?key=${encodeURIComponent(cloud_storage_path)}&${signedQuery('put', cloud_storage_path)}`;
  return { uploadUrl, cloud_storage_path };
}

// Upload direto de um buffer a partir do servidor (usado na importação do OneDrive).
export async function uploadBufferToS3(
  buffer: Buffer,
  fileName: string,
  _contentType: string,
  isPublic: boolean = false
) {
  const cloud_storage_path = newKey(fileName, isPublic);
  writeLocalFile(cloud_storage_path, buffer);
  return { cloud_storage_path };
}

export async function getFileUrl(
  cloud_storage_path: string,
  contentType: string,
  isPublic: boolean = false,
  forceInline: boolean = false
) {
  const inline = forceInline || shouldServeInline(contentType) ? '1' : '0';
  let url = `${appBaseUrl()}/api/local-storage/file/${encodeKey(cloud_storage_path)}?ct=${encodeURIComponent(contentType || 'application/octet-stream')}&inline=${inline}`;
  if (!isPublic || !isPublicKey(cloud_storage_path)) url += `&${signedQuery('get', cloud_storage_path)}`;
  return url;
}

// Leitura direta no servidor (evita pedidos HTTP a si próprio).
export async function readFileBuffer(cloud_storage_path: string): Promise<Buffer> {
  return readLocalFile(cloud_storage_path);
}

export async function deleteFile(cloud_storage_path: string) {
  deleteLocalFile(cloud_storage_path);
}
