import { GraficaConfig } from './types';

export type ArteFinalModo = 'cliente' | 'criacao' | 'adaptacao';

export const ARTE_FINAL_OPCOES: { id: ArteFinalModo; label: string; descricao: string }[] = [
  { id: 'cliente', label: 'Cliente fornece o ficheiro', descricao: 'O cliente entrega a arte pronta para impressão — sem custo de design.' },
  { id: 'criacao', label: 'Criação de raiz (nós fazemos)', descricao: 'A Criaconsensos cria a arte-final de raiz.' },
  { id: 'adaptacao', label: 'Adaptação / alteração de ficheiro', descricao: 'Ajuste de um ficheiro já existente do cliente.' },
];

// Valor sugerido para cada modo, com base na configuração.
export function arteFinalValorSugerido(modo: string | null | undefined, config: GraficaConfig): number {
  switch ((modo || 'cliente') as ArteFinalModo) {
    case 'criacao':
      return config.arteFinalCriacao ?? 0;
    case 'adaptacao':
      return config.arteFinalAdaptacao ?? 0;
    case 'cliente':
    default:
      return 0;
  }
}

export function arteFinalLabel(modo: string | null | undefined): string {
  const op = ARTE_FINAL_OPCOES.find((o) => o.id === (modo || 'cliente'));
  return op ? op.label : 'Arte-final';
}
