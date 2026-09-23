// Cliente Microsoft Graph (fluxo client credentials / app-only) para ler ficheiros
// das pastas de digitalizações no OneDrive da empresa.

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  eTag?: string;
  contentType?: string;
  lastModified?: string;
  subPath?: string; // caminho relativo das subpastas (ex.: 'FATURAS', 'C_PAG')
}

function getEnv() {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const driveUser = process.env.MS_GRAPH_DRIVE_USER;
  const rootPath = process.env.MS_GRAPH_ROOT_PATH;
  if (!clientId || !tenantId || !clientSecret || !driveUser || !rootPath) {
    throw new Error('Credenciais do OneDrive (Microsoft Graph) não configuradas.');
  }
  return { clientId, tenantId, clientSecret, driveUser, rootPath };
}

export async function getGraphToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const { clientId, tenantId, clientSecret } = getEnv();
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('scope', 'https://graph.microsoft.com/.default');
  params.set('grant_type', 'client_credentials');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao obter token do OneDrive: ${res.status} ${t}`);
  }
  const data = await res.json();
  const token = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

// Percorre recursivamente uma pasta (pelo id) e recolhe TODOS os ficheiros,
// incluindo os que estão dentro de subpastas. Assim, se o utilizador organizar
// os documentos em subpastas (ex.: FORNECEDORES/FATURAS), são igualmente lidos.
async function recolherFicheiros(
  driveUser: string,
  token: string,
  folderId: string,
  files: DriveFile[],
  depth: number,
  subPath: string = ''
): Promise<void> {
  if (depth > 6) return; // limite de segurança contra recursão excessiva
  let next: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    driveUser
  )}/drive/items/${folderId}/children?$select=id,name,size,file,folder,eTag,lastModifiedDateTime&$top=200`;
  const subpastas: { id: string; nome: string }[] = [];
  let guard = 0;
  while (next && guard < 20) {
    guard++;
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Falha ao listar conteúdo: ${res.status} ${t}`);
    }
    const data: any = await res.json();
    for (const item of data.value || []) {
      if (item.folder) {
        subpastas.push({ id: item.id, nome: item.name });
        continue;
      }
      if (!item.file) continue;
      files.push({
        id: item.id,
        name: item.name,
        size: item.size || 0,
        eTag: item.eTag,
        contentType: item.file?.mimeType,
        lastModified: item.lastModifiedDateTime,
        subPath,
      });
    }
    next = data['@odata.nextLink'] || null;
  }
  for (const sub of subpastas) {
    const novoSub = subPath ? `${subPath}/${sub.nome}` : sub.nome;
    await recolherFicheiros(driveUser, token, sub.id, files, depth + 1, novoSub);
  }
}

// Lista TODOS os ficheiros de uma pasta de módulo (recursivamente, incluindo subpastas).
export async function listFolderFiles(pasta: string): Promise<DriveFile[]> {
  const { driveUser, rootPath } = getEnv();
  const token = await getGraphToken();
  const encPath = `${rootPath}/${pasta}`
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  // Resolver o id da pasta de topo a partir do caminho.
  const metaUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    driveUser
  )}/drive/root:/${encPath}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (metaRes.status === 404) {
    // Pasta ainda não existe no OneDrive — devolve lista vazia.
    return [];
  }
  if (!metaRes.ok) {
    const t = await metaRes.text();
    throw new Error(`Falha ao aceder à pasta ${pasta}: ${metaRes.status} ${t}`);
  }
  const meta: any = await metaRes.json();
  if (!meta?.id) return [];
  const files: DriveFile[] = [];
  await recolherFicheiros(driveUser, token, meta.id, files, 0);
  return files;
}

// Descarrega o conteúdo binário de um ficheiro pelo seu id.
export async function downloadItem(
  driveItemId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const { driveUser } = getEnv();
  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    driveUser
  )}/drive/items/${driveItemId}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao descarregar o ficheiro: ${res.status} ${t}`);
  }
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

// Mapeamento pasta -> módulo da aplicação (fallback quando não há regra por subpasta/nome).
export const PASTA_MODULO: Record<string, string> = {
  DESPESAS: 'despesa',
  FORNECEDORES: 'fatura_fornecedor',
  IMPOSTOS: 'imposto',
  SEGUROS: 'seguro',
  VENCIMENTOS: 'vencimento',
};

// Decide o módulo de destino de um ficheiro tendo em conta a pasta de topo,
// a subpasta onde está e o próprio nome do ficheiro. Assim, dentro de
// FORNECEDORES, as FATURAS vão para "Faturas de Fornecedores" e os
// comprovativos de pagamento (C_PAG) vão para "Pagamentos".
export function resolverModulo(pasta: string, subPath: string, fileName: string): string {
  const fallback = PASTA_MODULO[pasta] || pasta.toLowerCase();
  if (pasta === 'FORNECEDORES') {
    const sub = (subPath || '').toUpperCase();
    const nome = (fileName || '').toUpperCase();
    // Comprovativos de pagamento a fornecedor.
    if (
      sub.includes('C_PAG') ||
      sub.includes('COMPROV') ||
      /COMP[_ ]?PAG|COMPROVATIVO/.test(nome)
    ) {
      return 'pagamento';
    }
    // Faturas de fornecedor (subpasta FATURAS ou nome a indicar fatura).
    if (sub.includes('FATURA') || /FATURA/.test(nome)) {
      return 'fatura_fornecedor';
    }
    // Por defeito, o conteúdo de FORNECEDORES é tratado como fatura de fornecedor.
    return 'fatura_fornecedor';
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Renomeação de ficheiros no OneDrive (requer permissão Files.ReadWrite.All).
// ---------------------------------------------------------------------------

// Remove caracteres inválidos para nomes de ficheiro (\ / : * ? " < > |),
// colapsa espaços e apara pontos/espaços nas extremidades.
export function sanitizeNomeFicheiro(s: string): string {
  return String(s ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();
}

function extensaoDe(nome: string): string {
  const m = /(\.[A-Za-z0-9]{1,8})$/.exec(nome || '');
  return m ? m[1] : '';
}

function anoDe(dataStr?: string | null): string | null {
  if (!dataStr) return null;
  const m = /(\d{4})/.exec(String(dataStr).trim());
  return m ? m[1] : null;
}

// Constrói o novo nome do ficheiro a partir do módulo e dos dados extraídos.
// Devolve null quando faltam os campos-chave (mantém-se o nome original).
//  - fatura_fornecedor -> <nomeFornecedor>_<numeroFatura>_<ano>
//  - pagamento          -> Comprovativo_<referencia>_<ano>
//  - despesa            -> Despesa_<data>_<valor>
export function nomeFicheiroDigitalizacao(
  modulo: string,
  dados: any,
  nomeOriginal: string
): string | null {
  const ext = extensaoDe(nomeOriginal);
  const limpa = (v: any) => sanitizeNomeFicheiro(String(v ?? '').trim());
  if (modulo === 'fatura_fornecedor') {
    const empresa = limpa(dados?.fornecedorNome || dados?.entidadeNome);
    const num = limpa(dados?.numeroFatura);
    const ano = anoDe(dados?.dataFatura);
    if (!num || !ano) return null;
    const partes = [empresa || 'Fatura', num, ano].filter(Boolean);
    return `${partes.join('_')}${ext}`;
  }
  if (modulo === 'pagamento') {
    const num = limpa(dados?.referencia);
    const ano = anoDe(dados?.dataPagamento);
    if (!num || !ano) return null;
    return `Comprovativo_${num}_${ano}${ext}`;
  }
  if (modulo === 'despesa') {
    const data = limpa(dados?.data);
    const valorNum = Number(dados?.valor);
    if (!data || dados?.valor == null || Number.isNaN(valorNum)) return null;
    const valor = valorNum.toFixed(2).replace('.', ',');
    return `Despesa_${data}_${valor}${ext}`;
  }
  return null;
}

// Renomeia um ficheiro no OneDrive (PATCH ao item). O id do item mantém-se.
export async function renameItem(driveItemId: string, novoNome: string): Promise<void> {
  const { driveUser } = getEnv();
  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    driveUser
  )}/drive/items/${driveItemId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: novoNome }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao renomear ficheiro (${res.status}): ${t.slice(0, 300)}`);
  }
}
