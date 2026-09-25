export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { listFolderFiles, downloadItem, PASTA_MODULO, resolverModulo, DriveFile } from '@/lib/onedrive/graph';
import { extractDados } from '@/lib/onedrive/extract';
import { detectDuplicate } from '@/lib/onedrive/records';
import { uploadBufferToS3 } from '@/lib/s3';

// Cada chamada processa um lote pequeno dentro de um orçamento de tempo, para
// nunca exceder os limites de tempo de resposta em produção. O cliente volta a
// chamar este endpoint enquanto houver ficheiros novos por processar.
const MAX_POR_EXECUCAO = 5;
const TEMPO_MAX_MS = 15000;

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  // Modo "voltar a ler os erros": só reprocessa digitalizações com erro que ainda
  // não foram tentadas desde 'desde' (início da ronda no navegador), para não repetir.
  const soErros = req.nextUrl.searchParams.get('erros') === '1';
  const desdeParam = req.nextUrl.searchParams.get('desde');
  const desde = desdeParam ? new Date(desdeParam) : null;

  // Autorização: sessão de utilizador OU chave de tarefa agendada.
  const cronKey = req.headers.get('x-cron-key');
  const isCron = !!cronKey && cronKey === process.env.CRON_SECRET;
  const criadoPor = 'Importação OneDrive';
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const resumo = {
    processados: 0,
    novos: 0,
    duplicados: 0,
    erros: 0,
    ignorados: 0,
    porPasta: {} as Record<string, { novos: number; duplicados: number; erros: number }>,
  };

  try {
    const existentes = await prisma.digitalizacaoImportada.findMany({
      select: { id: true, driveItemId: true, estado: true, cloudStoragePath: true, updatedAt: true },
    });
    const conhecidos = new Map(existentes.map((e) => [e.driveItemId, e]));

    // 1. Recolher candidatos. A listagem é barata; separamos ficheiros nunca
    //    vistos (prioritários) dos que ficaram em erro (reprocessados apenas
    //    quando sobra orçamento, para não criar ciclos infinitos no cliente).
    const nuncaVistos: { f: DriveFile; pasta: string; modulo: string }[] = [];
    const emErro: { f: DriveFile; pasta: string; modulo: string }[] = [];
    const vistosNestaExecucao = new Set<string>();

    for (const pasta of Object.keys(PASTA_MODULO)) {
      resumo.porPasta[pasta] = { novos: 0, duplicados: 0, erros: 0 };
      let ficheiros: DriveFile[];
      try {
        ficheiros = await listFolderFiles(pasta);
      } catch (e: any) {
        console.error(`Erro a listar ${pasta}:`, e?.message);
        continue;
      }
      for (const f of ficheiros) {
        if (vistosNestaExecucao.has(f.id)) continue; // evita duplicados na mesma árvore
        vistosNestaExecucao.add(f.id);
        // O módulo de destino depende da subpasta e do nome do ficheiro.
        const modulo = resolverModulo(pasta, f.subPath || '', f.name);
        const existente = conhecidos.get(f.id);
        if (!existente) {
          nuncaVistos.push({ f, pasta, modulo });
        } else if (existente.estado === 'erro' && (!desde || existente.updatedAt < desde)) {
          emErro.push({ f, pasta, modulo });
        }
        // Restantes (já importados) são ignorados.
      }
    }

    const processarUm = async (f: DriveFile, pasta: string, modulo: string) => {
      const existente = conhecidos.get(f.id);
      resumo.processados++;
      try {
        const { buffer, contentType } = await downloadItem(f.id);
        const ct = f.contentType || contentType;
        let cloudStoragePath = existente?.cloudStoragePath || null;
        if (!cloudStoragePath) {
          const up = await uploadBufferToS3(buffer, f.name, ct, false);
          cloudStoragePath = up.cloud_storage_path;
        }
        const { dados, erro } = await extractDados(modulo, buffer, ct, f.name);

        let estado = 'por_confirmar';
        let erroMsg: string | null = null;
        let duplicadoDeId: string | null = null;

        if (erro || !dados) {
          estado = 'erro';
          erroMsg = erro || 'Sem dados extraídos';
          resumo.erros++;
          resumo.porPasta[pasta].erros++;
        } else {
          duplicadoDeId = await detectDuplicate(modulo, dados);
          if (duplicadoDeId) {
            estado = 'duplicado';
            resumo.duplicados++;
            resumo.porPasta[pasta].duplicados++;
          } else {
            resumo.novos++;
            resumo.porPasta[pasta].novos++;
          }
        }

        const dadosComuns = {
          etag: f.eTag || null,
          pasta,
          modulo,
          nomeOriginal: f.name,
          contentType: ct,
          cloudStoragePath,
          isPublic: false,
          onedriveModified: f.lastModified ? new Date(f.lastModified) : null,
          dadosExtraidos: dados || undefined,
          estado,
          erroMsg,
          duplicadoDeId,
        };
        if (existente) {
          await prisma.digitalizacaoImportada.update({
            where: { id: existente.id },
            data: dadosComuns,
          });
          conhecidos.set(f.id, { id: existente.id, driveItemId: f.id, estado, cloudStoragePath, updatedAt: new Date() });
        } else {
          const criado = await prisma.digitalizacaoImportada.create({
            data: { driveItemId: f.id, criadoPor, ...dadosComuns },
            select: { id: true },
          });
          conhecidos.set(f.id, { id: criado.id, driveItemId: f.id, estado, cloudStoragePath, updatedAt: new Date() });
        }
      } catch (e: any) {
        console.error(`Erro a processar ${f.name}:`, e?.message);
        resumo.erros++;
        resumo.porPasta[pasta].erros++;
        const errMsg = (e?.message || 'Erro desconhecido').slice(0, 500);
        try {
          const ex2 = conhecidos.get(f.id);
          if (ex2 && ex2.id) {
            await prisma.digitalizacaoImportada.update({
              where: { id: ex2.id },
              data: { estado: 'erro', erroMsg: errMsg },
            });
          } else {
            const criado = await prisma.digitalizacaoImportada.create({
              data: {
                driveItemId: f.id,
                etag: f.eTag || null,
                pasta,
                modulo,
                nomeOriginal: f.name,
                contentType: f.contentType || null,
                estado: 'erro',
                erroMsg: errMsg,
                criadoPor,
              },
              select: { id: true },
            });
            conhecidos.set(f.id, { id: criado.id, driveItemId: f.id, estado: 'erro', cloudStoragePath: null, updatedAt: new Date() });
          }
        } catch {
          /* ignora se já existir */
        }
      }
    };

    // 2. Fase A — ficheiros nunca vistos (prioritários). Determina se ainda
    //    falta trabalho (o cliente volta a chamar enquanto for verdadeiro).
    let maisPorProcessar = false;
    for (const item of soErros ? [] : nuncaVistos) {
      if (resumo.processados >= MAX_POR_EXECUCAO || Date.now() - inicio > TEMPO_MAX_MS) {
        maisPorProcessar = true;
        break;
      }
      await processarUm(item.f, item.pasta, item.modulo);
    }

    // 3. Fase B — reprocessar erros só se ainda houver orçamento nesta chamada.
    if (!maisPorProcessar) {
      for (const item of emErro) {
        if (resumo.processados >= MAX_POR_EXECUCAO || Date.now() - inicio > TEMPO_MAX_MS) {
          if (soErros) maisPorProcessar = true;
          break;
        }
        await processarUm(item.f, item.pasta, item.modulo);
      }
    }

    return NextResponse.json({ ...resumo, maisPorProcessar });
  } catch (e: any) {
    console.error('Sync OneDrive falhou:', e?.message);
    return NextResponse.json(
      { error: e?.message || 'Falha na sincronização', ...resumo },
      { status: 500 }
    );
  }
}
