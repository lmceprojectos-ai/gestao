// Cruza os documentos do e-Fatura com os documentos guardados na app
// (faturas/notas de fornecedor e despesas).
//
// Os números vêm escritos de formas diferentes (e-Fatura "FT 2026A1/53382",
// app "53382 / 2026"), por isso compara-se o NIF do emitente e o número
// sequencial; na falta disso, o valor e a data.

export type DocApp = {
  id: string;
  origem: 'fatura' | 'despesa';
  tipo: string | null;
  numero: string | null;
  nif: string | null;
  nome: string | null;
  valor: number | null;
  data: Date | string | null;
};

export type DocEFatura = {
  id: string;
  emitenteNif: string;
  emitenteNome: string;
  numero: string;
  atcud: string | null;
  total: number;
  dataEmissao: Date | string;
};

// 'numero' = mesmo NIF e mesmo número; 'valor' = mesmo emitente, valor e data próxima.
export type Correspondencia = {
  forma: 'numero' | 'valor';
  doc: DocApp;
};

const DIAS_TOLERANCIA = 5;

export const soDigitos = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

function tokensNumericos(s: string | null | undefined): string[] {
  return (s || '').match(/\d+/g)?.map((t) => t.replace(/^0+(?=\d)/, '')) ?? [];
}

// Número sequencial do documento: o último bloco numérico do número
// ("FT 2026A1/53382" → "53382"; "NC 26201951/0000000793" → "793").
function sequencial(numero: string, atcud: string | null): string | null {
  const t = tokensNumericos(numero.split('/').pop());
  const seq = t[t.length - 1] ?? null;
  if (seq) return seq;
  const a = atcud?.split('-').pop();
  return a ? a.replace(/^0+(?=\d)/, '') : null;
}

function dataISO(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function diasEntre(a: string, b: string) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
}

// Palavra principal do nome (para documentos da app sem NIF).
const IGNORAR = new Set(['lda', 'sa', 's', 'a', 'unipessoal', 'de', 'da', 'do', 'e', 'comercio', 'portugal', 'sociedade']);
function palavraChave(nome: string | null | undefined): string | null {
  const palavras = (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !IGNORAR.has(p));
  return palavras[0] ?? null;
}

function mesmoEmitente(e: DocEFatura, d: DocApp): boolean {
  const nif = soDigitos(d.nif);
  if (nif) return nif === e.emitenteNif;
  const k = palavraChave(d.nome);
  return !!k && palavraChave(e.emitenteNome) === k;
}

export function cruzar(docsEFatura: DocEFatura[], docsApp: DocApp[]): Map<string, Correspondencia> {
  const resultado = new Map<string, Correspondencia>();
  const usados = new Set<string>();

  // 1.ª passagem: mesmo NIF e número sequencial presente no número guardado na app.
  // Documentos repetidos na app (a mesma fatura digitalizada várias vezes) contam uma vez.
  for (const e of docsEFatura) {
    const seq = sequencial(e.numero, e.atcud);
    if (!seq) continue;
    const cand = docsApp.find(
      (d) =>
        !usados.has(d.id) &&
        soDigitos(d.nif) === e.emitenteNif &&
        tokensNumericos(d.numero).includes(seq)
    );
    if (cand) {
      resultado.set(e.id, { forma: 'numero', doc: cand });
      usados.add(cand.id);
    }
  }

  // 1.ª-B: número completo igual (para documentos guardados na app sem NIF).
  const compacto = (s: string | null | undefined) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const e of docsEFatura) {
    if (resultado.has(e.id)) continue;
    const num = compacto(e.numero);
    if (num.length < 6) continue;
    const cand = docsApp.find((d) => !usados.has(d.id) && !soDigitos(d.nif) && compacto(d.numero) === num);
    if (cand) {
      resultado.set(e.id, { forma: 'numero', doc: cand });
      usados.add(cand.id);
    }
  }

  // 2.ª passagem: mesmo emitente, mesmo valor e data até 5 dias de diferença.
  for (const e of docsEFatura) {
    if (resultado.has(e.id)) continue;
    const dataE = dataISO(e.dataEmissao)!;
    const cand = docsApp
      .filter((d) => {
        if (usados.has(d.id) || d.valor === null) return false;
        const dataD = dataISO(d.data);
        return (
          mesmoEmitente(e, d) &&
          Math.abs(Math.abs(d.valor) - Math.abs(e.total)) <= 0.02 &&
          !!dataD &&
          diasEntre(dataD, dataE) <= DIAS_TOLERANCIA
        );
      })
      .sort((a, b) => diasEntre(dataISO(a.data)!, dataE) - diasEntre(dataISO(b.data)!, dataE))[0];
    if (cand) {
      resultado.set(e.id, { forma: 'valor', doc: cand });
      usados.add(cand.id);
    }
  }

  return resultado;
}
