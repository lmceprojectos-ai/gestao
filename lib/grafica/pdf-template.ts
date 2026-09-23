import { GraficaConfig, ResultadoOrcamento } from './types';

function eur(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
// valor com € à direita (estilo da folha original): "25,00€" / "25,0000€"
function eurSufixo(n: number, casas = 2): string {
  return `${(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas })}€`;
}
function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- Temas de cor por tipo de orçamento ----
// OC → amarelo/âmbar | ONF → azul | OL → cinzento médio
interface Tema {
  bar: string;      // fundo das barras de cabeçalho
  barText: string;  // texto sobre as barras
  tint: string;     // tom claro (células suaves)
  accent: string;   // cor de destaque para valores
  numCell: string;  // fundo da célula do n.º de orçamento
  numText: string;  // texto do n.º de orçamento
}
const TEMAS: Record<string, Tema> = {
  OC: { bar: '#f5b301', barText: '#1a1a1a', tint: '#fef3c7', accent: '#1d4ed8', numCell: '#f5b301', numText: '#1a1a1a' },
  ONF: { bar: '#3b82f6', barText: '#ffffff', tint: '#dbeafe', accent: '#1e40af', numCell: '#3b82f6', numText: '#ffffff' },
  OL: { bar: '#6b7280', barText: '#ffffff', tint: '#eceef1', accent: '#374151', numCell: '#6b7280', numText: '#ffffff' },
};

function produtoLabelPdf(produto: string): string {
  return produto === 'cartoes' ? 'Cartões Comerciais'
    : produto === 'stickers' ? 'Stickers / Adesivos'
    : produto === 'contratar' ? 'Contratar (Subcontratação)'
    : produto === 'imp_peq_formato' ? 'Flyers'
    : produto === 'vinil' ? 'Impressão digital de grande formato'
    : produto === 'livre' ? 'Trabalho'
    : produto;
}

function papelNomePdf(produto: string, esp: any, config: GraficaConfig): string | undefined {
  const isSticker = produto === 'stickers';
  const isContratar = produto === 'contratar';
  const isFlyer = produto === 'imp_peq_formato';
  const isVinil = produto === 'vinil';
  const papel = config.papeis.find((p) => p.id === esp.papelId);
  const substrato = config.stickers?.substratos?.find((s: any) => s.id === esp.substratoId);
  const vinilSubstrato = config.vinil?.substratos?.find((s: any) => s.id === esp.substratoId);
  const flyPapel = config.flyers?.papeis?.find((p: any) => p.id === esp.papelId);
  return isContratar ? undefined
    : isFlyer ? (flyPapel ? `${flyPapel.tipo} ${flyPapel.gramagem}g` : esp.papelId)
    : isSticker ? (substrato ? substrato.descricao : esp.substratoId)
    : isVinil ? (vinilSubstrato ? vinilSubstrato.descricao : esp.substratoId)
    : (papel ? `${papel.nome} (${papel.larguraMm}×${papel.alturaMm})` : esp.papelId);
}

function descParts(produto: string, esp: any, papelNome: string | undefined, config: GraficaConfig): { specLinha: string; acabLinha: string } {
  const isSticker = produto === 'stickers';
  const isContratar = produto === 'contratar';
  const isFlyer = produto === 'imp_peq_formato';
  const isVinil = produto === 'vinil';
  const FLYER_DIMS: Record<string, string> = { A4: '210 × 297 mm', A5: '148 × 210 mm', A6: '105 × 148 mm', DL: '99 × 210 mm' };
  const dim = isFlyer
    ? (FLYER_DIMS[esp.formato] || ((esp.larguraMm && esp.alturaMm) ? `${esp.larguraMm} × ${esp.alturaMm} mm` : '—'))
    : (!isContratar && esp.larguraMm && esp.alturaMm) ? `${esp.larguraMm} × ${esp.alturaMm} mm` : '—';
  const impressao = isContratar
    ? (esp.fornecedor ? `Fornecedor: ${esp.fornecedor}` : 'Trabalho subcontratado')
    : isFlyer
    ? `${esp.corFrente ? 'A cores' : 'Preto e branco'}${esp.frenteVerso ? ` · frente e verso${esp.corVerso === false ? ' (verso P&B)' : ''}` : ' · só frente'}`
    : isSticker
    ? `${esp.cor ? 'A cores' : 'Preto e branco'} · cobertura ${Math.round((esp.coberturaTinta ?? 1) * 100)}%`
    : isVinil
    ? (esp.imprimir === false ? 'Recorte (sem impressão)' : `A cores · cobertura ${Math.round((esp.coberturaTinta ?? 0.9) * 100)}%`)
    : `${esp.cor ? 'A cores' : 'Preto e branco'}${esp.frenteVerso ? ' · frente e verso' : ' · só frente'}`;
  const acabNomes: string[] = [];
  if (isContratar) {
    // sem acabamentos internos
  } else if (isFlyer) {
    for (const acId of esp.acabamentos || []) {
      const ac = (config.flyers?.acabamentos || []).find((a: any) => a.id === acId);
      if (ac) acabNomes.push(ac.nome);
    }
  } else if (isSticker) {
    if (esp.tipoCorte && esp.tipoCorte !== 'nenhum') acabNomes.push(`Corte: ${esp.tipoCorte}`);
    if (esp.laminacao) acabNomes.push('Laminação');
  } else if (isVinil) {
    if (esp.acabamento && esp.acabamento !== 'Nenhum') acabNomes.push(esp.acabamento);
    if (esp.aplicacaoNoLocal) acabNomes.push('Aplicação no local');
  } else {
    if (esp.tipoCorte && esp.tipoCorte !== 'nenhum') {
      const corte = config.cortes.find((c) => c.id === esp.tipoCorte);
      acabNomes.push(corte?.nome || String(esp.tipoCorte));
    }
    if (esp.vinco) acabNomes.push('Vinco');
    for (const lamId of esp.laminacoes || []) {
      const lam = config.laminacoes.find((l) => l.id === lamId);
      if (lam) acabNomes.push(lam.nome);
    }
  }
  const specLinha = isContratar
    ? [esp.descricao || null, impressao].filter(Boolean).join(' · ')
    : [dim !== '—' ? dim : null, papelNome, impressao].filter(Boolean).join(' · ');
  const acabLinha = isContratar
    ? 'Trabalho subcontratado a fornecedor externo'
    : acabNomes.length
    ? `Acabamentos: ${acabNomes.join(' · ')} · Preparação de ficheiro + setup`
    : 'Inclui preparação de ficheiro + setup';
  return { specLinha, acabLinha };
}

// Descrição completa de um produto (para reutilização fora do PDF, ex.: Moloni).
// Junta o nome do produto + a linha de especificações + a linha de acabamentos.
export function descricaoItemGrafica(produto: string, esp: any, config: GraficaConfig): string {
  if (produto === 'livre') {
    return String((esp && esp.descricao) || '').trim() || 'Trabalho';
  }
  const label = produtoLabelPdf(produto);
  const papel = papelNomePdf(produto, esp || {}, config);
  const { specLinha, acabLinha } = descParts(produto, esp || {}, papel, config);
  return [label, specLinha, acabLinha].filter(Boolean).join(' · ');
}

interface ItemPdf {
  produto: string;
  especificacoes: Record<string, any>;
  resultado: ResultadoOrcamento;
  arteFinalModo?: string | null;
  arteFinalValor?: number | null;
  produtoLabel?: string;
  papelNome?: string;
}

interface DadosPdf {
  numero: number;
  numeroFormatado?: string;
  tipo?: string; // OC | ONF | OL
  tipoLabel?: string;
  comIva?: boolean;
  data: Date;
  clienteNome?: string | null;
  clienteEmpresa?: string | null;
  clienteContacto?: string | null;
  clienteNif?: string | null;
  clienteMorada?: string | null;
  clienteEmail?: string | null;
  clienteTelefone?: string | null;
  produtoLabel: string;
  produto?: string;
  itens?: ItemPdf[];
  especificacoes: Record<string, any>;
  resultado: ResultadoOrcamento;
  notas?: string | null;
  config: GraficaConfig;
  papelNome?: string;
  logoDataUri?: string;
  cabecalhoDataUri?: string; // bloco completo (logo + contactos) fornecido em imagem
  descontoLabel?: string | null;
  prazoProducao?: string | null;
  entrega24h?: boolean | null;
  portes?: number | null;
  tipoPortes?: string | null;
  arteFinalModo?: string | null;
  arteFinalValor?: number | null;
  opcoesExtra?: { descricao: string; valor: number; incluida: boolean }[] | null;
  deslocacao?: { incluir?: boolean; valor?: number; distanciaKm?: number; custoKm?: number; numTecnicos?: number; horas?: number; custoHora?: number } | null;
  mbEntidade?: string | null;
  mbReferencia?: string | null;
  percentagemAdjudicacao?: number | null;
  mbLogoDataUri?: string;
  mbwayLogoDataUri?: string;
}

export function gerarHtmlOrcamento(d: DadosPdf): string {
  const r = d.resultado;
  const comIva = d.comIva !== false;
  const tipoKey = (d.tipo || 'OC') as 'OC' | 'ONF' | 'OL';
  const baseTema = TEMAS[tipoKey] || TEMAS.OC;
  const ap = d.config.aparenciaPdf || {};
  const coresCfg = (ap.cores && ap.cores[tipoKey]) || {};
  const t: Tema = {
    bar: coresCfg.bar || baseTema.bar,
    barText: coresCfg.barText || baseTema.barText,
    tint: coresCfg.tint || baseTema.tint,
    accent: coresCfg.accent || baseTema.accent,
    numCell: coresCfg.bar || baseTema.numCell,
    numText: coresCfg.barText || baseTema.numText,
  };
  const txt = ap.textos || {};
  const TXT = {
    colDescricao: txt.colDescricao || 'Descrição',
    colQtd: txt.colQtd || 'Qtd.',
    colPrecoUnit: txt.colPrecoUnit || 'Preço unit. (€)',
    colPrecoTotal: txt.colPrecoTotal || 'Preço bruto s/IVA (€)',
    labelProducao: txt.labelProducao || 'Produção',
    prazoNormal: txt.prazoNormal || '4-5 dias úteis',
    labelSubtotal: txt.labelSubtotal || 'Subtotal s/IVA',
    labelTotalComIva: txt.labelTotalComIva || 'TOTAL c/IVA',
    labelTotalSemIva: txt.labelTotalSemIva || 'TOTAL (s/IVA)',
    tituloCondicoes: txt.tituloCondicoes || 'CONDIÇÕES GERAIS DE VENDA',
  };
  const ivaPct = Math.round((d.config.iva || 0.23) * 100);

  const dataFmt = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(d.data);
  const validoAte = new Date(d.data.getTime() + 8 * 24 * 60 * 60 * 1000);
  const validoFmt = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(validoAte);
  const numeroDoc = d.numeroFormatado || `N.º ${d.numero}`;
  const prazoProducaoTxt = d.prazoProducao && d.prazoProducao.trim()
    ? d.prazoProducao.trim()
    : (d.entrega24h ? 'Produção urgente 24H' : '');

  const esp = d.especificacoes || {};

  // ---- Itens (multi-produto) ou item único (legado) ----
  const itemsList: ItemPdf[] = (d.itens && d.itens.length)
    ? d.itens
    : [{
        produto: d.produto || '',
        especificacoes: esp,
        resultado: r,
        arteFinalModo: d.arteFinalModo,
        arteFinalValor: d.arteFinalValor,
        produtoLabel: d.produtoLabel,
        papelNome: d.papelNome,
      }];
  const multiItem = itemsList.length > 1;

  // Linhas de descrição (uma por produto)
  const descRowsHtml = itemsList.map((it) => {
    const rr = it.resultado;
    const isLivreItem = it.produto === 'livre';
    const livreTxt = isLivreItem ? String((it.especificacoes || {}).descricao || '').trim() : '';
    const livreLines = livreTxt ? livreTxt.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    const label = isLivreItem
      ? (livreLines[0] || 'Trabalho')
      : (it.produtoLabel || produtoLabelPdf(it.produto));
    const papelNomeItem = it.papelNome ?? papelNomePdf(it.produto, it.especificacoes || {}, d.config);
    const parts = isLivreItem
      ? { specLinha: livreLines.slice(1).join(' · '), acabLinha: '' }
      : descParts(it.produto, it.especificacoes || {}, papelNomeItem, d.config);
    const arteItemValor = Number(it.arteFinalValor) > 0 ? Number(it.arteFinalValor) : 0;
    const arteItemModo = it.arteFinalModo || 'cliente';
    const arteNota = !multiItem ? '' : (arteItemModo === 'cliente'
      ? 'Arte-final: ficheiro do cliente'
      : `Arte-final (${arteItemModo === 'criacao' ? 'criação' : 'adaptação'})${arteItemValor > 0 ? ': ' + eurSufixo(arteItemValor, 2) : ''}`);
    // Preço BRUTO s/IVA da linha = antes de qualquer condição (desconto de cliente e sobretaxa 24H).
    // As condições são apresentadas separadamente no quadro de totais.
    const dcI = rr.descontoCliente || 0;
    const stI = rr.sobretaxa24h || 0;
    const fatorI = (dcI > 0 && dcI < 1 ? (1 - dcI) : 1) * (1 + stI);
    const brutoItem = fatorI > 0 ? (rr.precoSemIva || 0) / fatorI : (rr.precoSemIva || 0);
    const unitBruto = rr.quantidade > 0 ? brutoItem / rr.quantidade : 0;
    return `<tr>
          <td>
            <div class="pnome">${esc(label || '—')}</div>
            ${parts.specLinha ? `<div class="pspec">${esc(parts.specLinha)}</div>` : ''}
            ${parts.acabLinha ? `<div class="pacab">${esc(parts.acabLinha)}</div>` : ''}
            ${arteNota ? `<div class="pacab">${esc(arteNota)}</div>` : ''}
          </td>
          <td class="c">${rr.quantidade}</td>
          <td class="r">${eurSufixo(unitBruto, 4)}</td>
          <td class="r"><b>${eurSufixo(brutoItem, 2)}</b></td>
        </tr>`;
  }).join('');

  // ---- Agregados de totais ----
  const somaSemIva = itemsList.reduce((s, it) => s + (it.resultado.precoSemIva || 0), 0);
  const somaComIva = itemsList.reduce((s, it) => s + (it.resultado.precoComIva || 0), 0);
  const ivaRate = d.config.iva || 0.23;
  const portes = d.portes && d.portes > 0 ? d.portes : 0;
  const tipoPortes = d.tipoPortes || 'levantamento';
  const portesLabel = tipoPortes === 'envio24h' ? 'Portes de envio 24H'
    : tipoPortes === 'envio' ? 'Portes de Envio'
    : 'Levantar no armazém';
  const arteFinal = itemsList.reduce((s, it) => s + (Number(it.arteFinalValor) > 0 ? Number(it.arteFinalValor) : 0), 0);
  const arteFinalModo = itemsList[0]?.arteFinalModo || d.arteFinalModo || 'cliente';
  const arteFinalLabelTxt = multiItem
    ? 'Arte-final (total)'
    : arteFinalModo === 'criacao' ? 'Arte-final (criação)'
    : arteFinalModo === 'adaptacao' ? 'Arte-final (adaptação)'
    : 'Arte-final (ficheiro do cliente)';
  const opcoes = Array.isArray(d.opcoesExtra) ? d.opcoesExtra : [];
  const opcoesIncluidas = opcoes.filter((o) => o.incluida).reduce((s, o) => s + (Number(o.valor) || 0), 0);
  const deslocacaoVal = d.deslocacao && d.deslocacao.incluir ? (Number(d.deslocacao.valor) || 0) : 0;
  const valorIvaProduto = somaComIva - somaSemIva;
  const valorIvaPortes = comIva ? portes * ivaRate : 0;
  const valorIvaArte = comIva ? arteFinal * ivaRate : 0;
  const valorIvaOpcoes = comIva ? opcoesIncluidas * ivaRate : 0;
  const valorIvaDeslocacao = comIva ? deslocacaoVal * ivaRate : 0;
  const valorIva = valorIvaProduto + valorIvaPortes + valorIvaArte + valorIvaOpcoes + valorIvaDeslocacao;
  const totalDoc = (comIva ? somaComIva : somaSemIva) + portes + valorIvaPortes + arteFinal + valorIvaArte + opcoesIncluidas + valorIvaOpcoes + deslocacaoVal + valorIvaDeslocacao;

  // Bloco de opções para o cliente decidir
  const opcoesHtml = opcoes.length
    ? `<table class="opc">
        <thead><tr><th style="width:10mm"></th><th>Opção (o cliente decide)</th><th class="r" style="width:34mm">Valor</th></tr></thead>
        <tbody>
          ${opcoes.map((o) => `<tr>
            <td class="c">${o.incluida ? '<span class="bx on">☑</span>' : '<span class="bx">☐</span>'}</td>
            <td>${esc(o.descricao || '—')}</td>
            <td class="r">${(Number(o.valor) || 0) > 0 ? eur(Number(o.valor)) : 'Sem custo'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '';

  // Decomposição em valores (€): preço bruto s/IVA (antes de qualquer condição)
  // e os incrementos/decrementos de cada condição em valor absoluto (nunca em %).
  // psi = base * (1 - desconto) * (1 + sobretaxa)  =>  base = psi / ((1-desconto)(1+sobretaxa))
  let precoBrutoBase = 0;   // preço bruto s/IVA, antes de descontos e sobretaxas
  let descontoValor = 0;    // valor (€) do desconto (tipo de cliente)
  let sobretaxaValor = 0;   // valor (€) da produção urgente 24H
  for (const it of itemsList) {
    const dc = (it.resultado.descontoCliente || 0);
    const st = (it.resultado.sobretaxa24h || 0);
    const psi = it.resultado.precoSemIva || 0;
    const fatorDesc = dc > 0 && dc < 1 ? (1 - dc) : 1;
    const base = psi / (fatorDesc * (1 + st));
    precoBrutoBase += base;
    descontoValor += dc > 0 && dc < 1 ? base * dc : 0;
    sobretaxaValor += st > 0 ? base * fatorDesc * st : 0;
  }
  // Total s/IVA (após todas as condições) e IVA
  const totalSemIva = somaSemIva + arteFinal + portes + opcoesIncluidas + deslocacaoVal;
  const opcoesComValor = opcoes.filter((o) => o.incluida && (Number(o.valor) || 0) > 0);
  const temAjustes = descontoValor > 0 || sobretaxaValor > 0 || arteFinal > 0 || portes > 0 || opcoesComValor.length > 0 || deslocacaoVal > 0;

  // Bloco de pagamento
  const entidadeMB = d.config.entidadeMB || '';
  const chaveMB = d.config.chaveMB || '';
  const mbway = d.config.mbwayNumero || '';
  const isONF = (d.tipo || 'OC') === 'ONF';
  // MB WAY: ONF paga para 912 256 186; OC/OL para o número da config (914 358 882)
  const mbwayNum = isONF ? '912 256 186' : mbway;

  // Logótipos oficiais (imagem) com fallback para a marca desenhada em CSS
  const mbLogoHtml = d.mbLogoDataUri
    ? `<div class="pay-logo"><img src="${d.mbLogoDataUri}" alt="Multibanco" /></div>`
    : `<div class="mbmark">
        <div class="brk"><span></span><span></span></div>
        <div class="txt">MB</div>
        <div class="brk"><span></span><span></span></div>
        <div class="cap">MULTIBANCO</div>
      </div>`;
  const mbwayLogoHtml = d.mbwayLogoDataUri
    ? `<div class="pay-logo"><img src="${d.mbwayLogoDataUri}" alt="MB WAY" /></div>`
    : `<div class="mbwmark">
        <div class="mb">
          <div class="brk"><span></span><span></span></div>
          <div class="txt-mb">MB</div>
          <div class="brk"><span></span><span></span></div>
        </div>
        <div class="txt-way">WAY</div>
      </div>`;
  const mbEntidadeRef = (d.mbEntidade || '').trim();
  const mbReferenciaRef = (d.mbReferencia || '').trim();
  const temRefMB = !!(mbEntidadeRef && mbReferenciaRef);

  // ---- Adjudicação por-orçamento (1..99) ----
  // Quando definida, o título e o valor das referências MB / MB WAY refletem a
  // adjudicação; null/0/100 => pagamento total (comportamento anterior).
  const pctAdjRaw = d.percentagemAdjudicacao;
  const temAdj = pctAdjRaw != null && pctAdjRaw > 0 && pctAdjRaw < 100;
  const pctAdj = temAdj ? (pctAdjRaw as number) : 0;
  const valorAdj = temAdj ? totalDoc * (pctAdj / 100) : totalDoc;
  // Página 2 (condições): usa a % do orçamento se definida, senão a % global de config.
  const pctAdjPagina2 = temAdj ? pctAdj : (d.config.percentagemAdjudicacao ?? 0);
  const condicoesTexto = (d.config.condicoesVenda || '').trim();
  const blocosCond = condicoesTexto
    ? condicoesTexto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    : [];
  const condHtml = blocosCond.length
    ? blocosCond.map((b) => `<div class="cl">${esc(b).replace(/\n/g, '<br/>')}</div>`).join('')
    : '<div class="cl" style="color:#9ca3af">(sem condições definidas — edite na configuração)</div>';

  const logo = d.logoDataUri
    ? `<img src="${d.logoDataUri}" alt="CRIACONSENSOS" style="height:22mm;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:800;color:#111">CRIA<span style="color:${t.accent}">CONSENSOS</span></div>`;

  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 10px; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; padding: 0; }
  .page + .page { page-break-before: always; }

  /* ---- Cabeçalho ---- */
  .hd-img { position: absolute; top: 10mm; left: 13mm; width: 55mm; }
  .hd-img img { width: 100%; height: auto; display: block; }
  .hd-logo { position: absolute; top: 9mm; left: 12mm; width: 78mm; }
  .contacts { margin-top: 3mm; font-size: 9px; color: #374151; line-height: 1.5; }
  .contacts .row { display: flex; align-items: flex-start; gap: 2mm; margin-bottom: 1mm; }
  .contacts .ic { color: ${t.accent}; font-weight: 700; }
  .contacts b { color: #111; }
  .tagline { font-size: 8.5px; letter-spacing: .08em; color: #6b7280; margin-top: 1mm; }

  /* ---- Caixa n.º do orçamento (topo direito) ---- */
  .orc-box { position: absolute; top: 18mm; left: 138mm; width: 60mm; border-collapse: separate; border-spacing: 0; border: 1px solid #d1d5db; border-radius: 1.6mm; }
  .orc-box td { padding: 2mm 3mm; font-size: 10px; }
  .orc-box .num { background: ${t.numCell}; color: ${t.numText}; font-weight: 800; font-size: 12px; text-align: center; border-top-left-radius: 1.6mm; border-top-right-radius: 1.6mm; }
  .orc-box .lbl { background: #f8fafc; font-weight: 600; color: #374151; width: 31mm; border-top: 1px solid #d1d5db; }
  .orc-box .val { font-weight: 700; text-align: center; border-top: 1px solid #d1d5db; border-left: 1px solid #d1d5db; }
  .orc-box tr:last-child .lbl { border-bottom-left-radius: 1.6mm; }
  .orc-box tr:last-child .val { border-bottom-right-radius: 1.6mm; }

  /* ---- Bloco CLIENTE (POSIÇÃO EXATA p/ janela do envelope) ---- */
  .cliente { position: absolute; top: 46mm; left: 99mm; width: 90mm; min-height: 34mm;
             background: #f2f4f5; border-radius: 3mm; padding: 4mm 5mm; }
  .cliente .nome { font-weight: 800; font-size: 13px; color: #111827; line-height: 1.25; }
  .cliente .lin { font-size: 11px; color: #4b5563; line-height: 1.35; margin-top: 0.5mm; }

  /* ---- Corpo principal ---- */
  .body { position: absolute; top: 90mm; left: 12mm; width: 186mm; }
  table.blk { width: 100%; border-collapse: collapse; }
  .bar td { background: ${t.bar}; color: ${t.barText}; font-weight: 800; font-size: 11px; padding: 2mm 3mm; letter-spacing: .02em; border-top-left-radius: 1.6mm; border-top-right-radius: 1.6mm; }

  .desc { margin-top: 0; border-collapse: separate; border-spacing: 0; width: 100%; }
  .desc th { background: ${t.bar}; color: ${t.barText}; font-weight: 800; font-size: 10px; padding: 2mm 3mm; text-align: left; border: none; }
  .desc th:first-child { border-top-left-radius: 1.6mm; }
  .desc th:last-child { border-top-right-radius: 1.6mm; }
  .desc th.r, .desc td.r { text-align: right; }
  .desc th.c, .desc td.c { text-align: center; }
  .desc td { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 3mm; font-size: 10px; vertical-align: top; }
  .desc td:first-child { border-left: 1px solid #e5e7eb; }
  .desc .pnome { font-weight: 800; color: #111; font-size: 10.5px; margin-bottom: 1mm; }
  .desc .pspec { color: #374151; font-size: 9.5px; line-height: 1.45; }
  .desc .pacab { color: #6b7280; font-size: 9px; line-height: 1.45; margin-top: 1mm; }

  /* ---- Opções (o cliente decide) ---- */
  .opc { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 4mm; }
  .opc th { background: ${t.tint}; color: ${t.accent}; font-weight: 800; font-size: 9.5px; padding: 2mm 3mm; text-align: left; }
  .opc th.r { text-align: right; }
  .opc th:first-child { border-top-left-radius: 1.6mm; }
  .opc th:last-child { border-top-right-radius: 1.6mm; }
  .opc td { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 2.2mm 3mm; font-size: 9.5px; color: #1f2937; }
  .opc td:first-child { border-left: 1px solid #e5e7eb; }
  .opc td.c { text-align: center; }
  .opc td.r { text-align: right; font-weight: 700; }
  .opc .bx { font-size: 12px; color: #6b7280; }
  .opc .bx.on { color: #0f9d58; font-weight: 800; }

  /* ---- Acabamentos + Totais (lado a lado) ---- */
  .cols { display: flex; gap: 5mm; margin-top: 4mm; }
  .col-l { width: 54%; }
  .col-r { width: 46%; }
  .acab-tit { font-size: 10px; color: #6b7280; font-weight: 600; margin-bottom: 2mm; }
  .chk { font-size: 10px; color: #111; margin-bottom: 1.6mm; line-height: 1.3; }
  .chk .tick { color: #0f9d58; font-weight: 800; }
  .chk.off { color: #9ca3af; text-decoration: line-through; }

  table.tot { width: 100%; border-collapse: collapse; }
  table.tot td { padding: 2mm 3mm; font-size: 10px; }
  table.tot .info { background: ${t.tint}; color: ${t.accent}; font-weight: 700; text-align: center; }
  table.tot .lbl { text-align: right; font-weight: 700; color: #374151; }
  table.tot .val { text-align: right; font-weight: 700; color: #111; background: #f3f4f6; width: 28mm; }
  table.tot { border-collapse: separate; border-spacing: 0; }
  table.tot .grand td { background: ${t.bar}; color: ${t.barText}; font-weight: 800; font-size: 12px; }
  table.tot .grand td:first-child { border-radius: 1.6mm 0 0 1.6mm; }
  table.tot .grand td:last-child { border-radius: 0 1.6mm 1.6mm 0; }

  /* ---- Pagamento ---- */
  .pay { margin-top: 4mm; }
  .pay-row { display: flex; align-items: center; gap: 5mm; padding: 2.4mm 0; border-top: 1px solid #eef0f2; }
  .pay-row:first-child { border-top: none; }
  .pay-info { flex: 1; text-align: right; font-size: 9.5px; color: #374151; line-height: 1.55; }
  .pay-ttl { font-weight: 800; color: #111; font-size: 9.5px; letter-spacing: .02em; margin-bottom: 0.4mm; }
  .pay-info b { color: #111; }
  /* --- Marca MB Multibanco --- */
  .mbmark { width: 24mm; flex-shrink: 0; text-align: center; }
  .mbmark .brk { display: flex; justify-content: center; gap: 2.5mm; }
  .mbmark .brk span { display: block; width: 6mm; height: 1.7mm; border-radius: 1mm; background: #0033a0; }
  .mbmark .txt { font-weight: 900; font-size: 20px; color: #0033a0; letter-spacing: -1.5px; line-height: 1.1; margin: 0.3mm 0; }
  .mbmark .cap { font-size: 6px; font-weight: 800; letter-spacing: 1.6px; color: #0033a0; }
  /* --- Marca MB WAY --- */
  .mbwmark { width: 24mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 2mm; }
  .mbwmark .mb { text-align: center; }
  .mbwmark .brk { display: flex; justify-content: center; gap: 2mm; }
  .mbwmark .brk span { display: block; width: 5mm; height: 1.5mm; border-radius: 1mm; background: #e2001a; }
  .mbwmark .txt-mb { font-weight: 900; font-size: 17px; color: #e2001a; letter-spacing: -1px; line-height: 1.1; margin: 0.3mm 0; }
  .mbwmark .txt-way { font-weight: 900; font-size: 16px; color: #111; letter-spacing: -0.5px; }
  /* --- Logótipos por imagem (MB / MB WAY) --- */
  .pay-logo { width: 24mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .pay-logo img { max-width: 23mm; max-height: 14mm; object-fit: contain; }

  /* ---- Página 2 ---- */
  .cond-wrap { position: absolute; top: 14mm; left: 12mm; width: 186mm; }
  .cond-bar { background: ${t.bar}; color: ${t.barText}; font-weight: 800; font-size: 14px; text-align: center; padding: 3mm; letter-spacing: .04em; border: 1px solid ${t.bar}; border-radius: 1.6mm; }
  .adj { display: flex; justify-content: center; align-items: center; gap: 3mm; padding: 2.5mm; border: 1px solid #e5e7eb; border-top: none; font-size: 11px; }
  .adj .k { font-weight: 800; color: #111; }
  .adj .v { background: ${t.tint}; color: ${t.accent}; font-weight: 800; padding: 0.5mm 6mm; border-radius: 1mm; }
  .cl { border: 1px solid #e5e7eb; border-top: none; padding: 3mm 4mm; font-size: 10.5px; color: #1f2937; line-height: 1.45; }
  .cond-open { border: 1px solid #e5e7eb; border-top: none; min-height: 55mm; }
</style></head>
<body>

  <!-- ============ PÁGINA 1 (FRENTE) ============ -->
  <div class="page">
    ${d.cabecalhoDataUri
      ? `<div class="hd-img"><img src="${d.cabecalhoDataUri}" alt="CRIACONSENSOS" /></div>`
      : `<div class="hd-logo">
      ${logo}
      ${d.logoDataUri ? '' : '<div class="tagline">SERVIÇOS GRÁFICOS | PUBLICIDADE</div>'}
      <div class="contacts">
        <div class="row"><span class="ic">◉</span><span>Rua João Lino | Lote 35 | Arm 20E<br/>2830-222 Barreiro</span></div>
        <div class="row"><span class="ic">☎</span><span>T +351 212 099 037<br/>M +351 914 358 882</span></div>
        <div class="row"><span class="ic">⊕</span><span>www.<b>CRIACONSENSOS</b>.pt</span></div>
        <div class="row"><span class="ic">✉</span><span>kh4@kh4.pt</span></div>
        <div class="row" style="margin-top:2mm"><span class="ic">⬢</span><span><b>CRIACONSENSOS</b> Unipessoal Lda<br/>NIF PT 515 943 401</span></div>
      </div>
    </div>`}

    <table class="orc-box">
      <tr><td class="num" colspan="2" style="text-align:center">${esc(numeroDoc)}</td></tr>
      <tr><td class="lbl">Data da Proposta</td><td class="val">${dataFmt}</td></tr>
      <tr><td class="lbl">Válido até</td><td class="val">${validoFmt}</td></tr>
      ${prazoProducaoTxt ? `<tr><td class="lbl">Prazo de produção</td><td class="val">${esc(prazoProducaoTxt)}</td></tr>` : ''}
    </table>

    <div class="cliente">
      <div class="nome">${esc(d.clienteEmpresa || d.clienteNome || '—')}</div>
      ${d.clienteEmpresa && d.clienteNome ? `<div class="lin">${esc(d.clienteNome)}</div>` : ''}
      ${d.clienteNif ? `<div class="lin">NIF: ${esc(d.clienteNif)}</div>` : ''}
      ${d.clienteMorada ? `<div class="lin">${esc(d.clienteMorada)}</div>` : ''}
      ${d.clienteEmail ? `<div class="lin">${esc(d.clienteEmail)}</div>` : ''}
      ${d.clienteTelefone ? `<div class="lin">${esc(d.clienteTelefone)}</div>` : ''}
      ${!d.clienteEmail && !d.clienteTelefone && d.clienteContacto ? `<div class="lin">${esc(d.clienteContacto)}</div>` : ''}
    </div>

    <div class="body">
      <table class="desc">
        <thead><tr>
          <th>${esc(TXT.colDescricao)}</th><th class="c" style="width:16mm">${esc(TXT.colQtd)}</th>
          <th class="r" style="width:32mm">${esc(TXT.colPrecoUnit)}</th>
          <th class="r" style="width:36mm">${esc(TXT.colPrecoTotal)}</th>
        </tr></thead>
        <tbody>${descRowsHtml}</tbody>
      </table>

      ${opcoesHtml}

      <div class="cols">
        <div class="col-l"></div>
        <div class="col-r">
          <table class="tot">
            <tr><td class="lbl">${esc(TXT.colPrecoTotal).replace(/\s*\(€\)\s*$/, '')}</td><td class="val">${eur(precoBrutoBase)}</td></tr>
            ${sobretaxaValor > 0 ? `<tr><td class="lbl">Produção urgente 24H</td><td class="val">+${eur(sobretaxaValor)}</td></tr>` : ''}
            ${descontoValor > 0 ? `<tr><td class="lbl">Desconto${d.descontoLabel ? ' ' + esc(d.descontoLabel) : ' cliente'}</td><td class="val">−${eur(descontoValor)}</td></tr>` : ''}
            ${arteFinal > 0 ? `<tr><td class="lbl">${esc(arteFinalLabelTxt)}</td><td class="val">+${eur(arteFinal)}</td></tr>` : ''}
            ${opcoesComValor.map((o) => `<tr><td class="lbl">${esc(o.descricao || 'Opção')}</td><td class="val">+${eur(Number(o.valor))}</td></tr>`).join('')}
            ${portes > 0 ? `<tr><td class="lbl">${portesLabel}</td><td class="val">+${eur(portes)}</td></tr>` : ''}
            ${deslocacaoVal > 0 ? `<tr><td class="lbl">Deslocação / montagem</td><td class="val">+${eur(deslocacaoVal)}</td></tr>` : ''}
            ${temAjustes ? `<tr><td class="lbl">${esc(TXT.labelSubtotal)}</td><td class="val">${eur(totalSemIva)}</td></tr>` : ''}
            ${comIva ? `<tr><td class="lbl">IVA (${ivaPct}%)</td><td class="val">${eur(valorIva)}</td></tr>` : ''}
            <tr class="grand"><td>${comIva ? esc(TXT.labelTotalComIva) : esc(TXT.labelTotalSemIva)}</td><td style="text-align:right">${eur(totalDoc)}</td></tr>
          </table>

          <div class="pay">
            ${!isONF ? `<div class="pay-row">
              ${mbLogoHtml}
              <div class="pay-info">
                <div class="pay-ttl">${temAdj ? `REFERÊNCIA MULTIBANCO (ADJUDICAÇÃO ${pctAdj}%)` : 'REFERÊNCIA MULTIBANCO (PAGAMENTO TOTAL)'}</div>
                ${temRefMB
                  ? `Entidade: <b>${esc(mbEntidadeRef)}</b><br/>Referência: <b>${esc(mbReferenciaRef)}</b><br/>Valor: <b>${eur(valorAdj)}</b>`
                  : `${entidadeMB ? `Entidade: <b>${esc(entidadeMB)}</b><br/>` : ''}Valor: <b>${eur(valorAdj)}</b>`}
              </div>
            </div>` : ''}
            <div class="pay-row">
              ${mbwayLogoHtml}
              <div class="pay-info">
                <div class="pay-ttl">${temAdj ? `MB WAY (ADJUDICAÇÃO ${pctAdj}%)` : 'PAGAMENTO TOTAL'}</div>
                Colocar na descrição o n.º orçamento<br/>
                ${mbwayNum ? `Para o número <b>${esc(mbwayNum)}</b><br/>` : ''}
                Valor: <b>${eur(valorAdj)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ============ PÁGINA 2 (VERSO — CONDIÇÕES) ============ -->
  <div class="page">
    <div class="cond-wrap">
      <div class="cond-bar">${esc(TXT.tituloCondicoes)}</div>
      <div class="adj"><span class="k">% de adjudicação (adiantamento):</span> <span class="v">${pctAdjPagina2}%</span></div>
      ${condHtml}
      <div class="cond-open"></div>
    </div>
  </div>

</body></html>`;
}