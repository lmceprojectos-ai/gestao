import { prisma } from '@/lib/db';
import { GraficaConfig } from './types';
import { configGraficaDefault } from './config-default';

// Carrega a configuração gráfica da base de dados, criando o registo padrão
// na primeira utilização. Faz merge com o default para garantir que novos
// campos têm sempre valor.
export async function carregarConfigGrafica(): Promise<GraficaConfig> {
  let registo = await prisma.configuracaoGrafica.findUnique({ where: { chave: 'default' } });
  if (!registo) {
    registo = await prisma.configuracaoGrafica.create({
      data: { chave: 'default', dados: configGraficaDefault as any },
    });
  }
  const dados = (registo.dados as any) || {};
  return { ...configGraficaDefault, ...dados } as GraficaConfig;
}
