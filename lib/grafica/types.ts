// Motor de cálculo — Orçamentos Gráficos
// Arquitetura preparada para múltiplos produtos (cartões, flyers, vinil, placas, stickers...)

export interface EquipamentoConfig {
  nome: string;
  investimento: number; // €
  amortMeses: number; // meses de amortização
  horasUsoDia: number; // horas de uso por dia (para custo €/hora do equipamento)
}

export interface PapelConfig {
  id: string; // P1..P4
  nome: string;
  gramagem: number; // g
  larguraMm: number;
  alturaMm: number;
  custoBase: number; // € por resma (antes de margem fornecedor)
  margemFornecedor: number; // ex 0.2 => custoBase*1.2
  folhasResma: number;
  unidadeVenda?: string; // etiqueta organizacional (folha/caixa/rolo/m²) — não altera o cálculo
  categoria?: string; // categoria do catálogo de substratos
}

export interface AcabamentoCorteConfig {
  id: string; // guilhotina, cantos, contorno, vinco
  nome: string;
  velocidade: number; // folhas/min (legado — não usado no modelo Excel)
  setupMin: number; // minutos de setup (legado — não usado no modelo Excel)
  equipamento: string; // nome do equipamento associado (para custo €/hora)
  folhasHora?: number; // folhas/hora (modelo Excel: custo/folha = custoHoraMaquina ÷ folhasHora)
}

export interface LaminacaoConfig {
  id: string;
  nome: string;
  custoFolha: number; // € por folha (taxa fixa)
  setup: number; // € custo mínimo / setup
}

export interface FaixaMargem {
  quantidade: number;
  margem: number; // 0..1
}

export interface DescontoCliente {
  tipo: string; // novo, frequente, revenda
  label: string;
  desconto: number; // 0..1
}

// ---- Aparência do PDF (personalizável na configuração) ----
export interface TemaPdfConfig {
  bar?: string;     // cor principal (barras / cabeçalhos / n.º do orçamento)
  barText?: string; // cor do texto sobre a cor principal
  tint?: string;    // tom claro (fundos suaves / destaques)
  accent?: string;  // cor de destaque (acentos)
}

export interface AparenciaPdf {
  cores?: {
    OC?: TemaPdfConfig;
    ONF?: TemaPdfConfig;
    OL?: TemaPdfConfig;
  };
  textos?: {
    colDescricao?: string;
    colQtd?: string;
    colPrecoUnit?: string;
    colPrecoTotal?: string;
    labelProducao?: string;
    prazoNormal?: string;
    labelSubtotal?: string;
    labelTotalComIva?: string;
    labelTotalSemIva?: string;
    tituloCondicoes?: string;
  };
  cabecalhoDataUri?: string; // imagem de cabeçalho personalizada (base64); vazio = usa a predefinida
}

export interface CustosFixosConfig {
  operadorMes: number;
  rendaMes: number;
  softwareAno: number;
  segurosAno: number;
  diasUteisMes: number;
  horasDia: number;
  // Taxa de ocupação real (0..1): fração das horas de calendário que são,
  // na prática, faturáveis/produtivas. Distribui os custos fixos apenas
  // pelas horas realmente produtivas → custo/minuto mais realista.
  // Predefinição 1 (100%) mantém o comportamento anterior.
  taxaOcupacao?: number;
}

export interface GraficaConfig {
  // impressão
  velocidadeImpressao: number; // folhas/min
  preImpMin: number; // minutos de pré-impressão por trabalho
  cliqueCor: number; // € por clique (cor)
  cliquePB: number; // € por clique (P&B)
  refugoPapel: number; // 0..1 (legado — não usado no modelo Excel)
  refugoImpressao: number; // 0..1 (legado — não usado no modelo Excel)
  // ---- Modelo Excel (CRIAORCAMENTOS v3) ----
  overheadPct?: number; // custos indiretos sobre o custo direto (0.15)
  custoHoraMaquina?: number; // €/hora das máquinas de corte/vinco/dobra (31.75)
  setupCorteEur?: number; // € por setup de corte/vinco/dobra (5)
  tintaMutohM2?: number; // €/m² de tinta Mutoh (1.4)
  // imposição
  deducaoLarguraMm: number; // dedução de largura útil
  perdaAgarreMm: number; // perda de agarre (aplicada 2x na altura)
  // custos fixos e equipamento
  custosFixos: CustosFixosConfig;
  equipamentos: EquipamentoConfig[];
  // materiais e acabamentos
  papeis: PapelConfig[];
  cortes: AcabamentoCorteConfig[];
  laminacoes: LaminacaoConfig[];
  // preços / margens
  faixasMargem: FaixaMargem[];
  descontosCliente: DescontoCliente[];
  sobretaxa24h: number; // 0..1
  margemMinima: number; // 0..1 (alerta visual)
  iva: number; // 0..1
  // arte-final (design do ficheiro) — valores de serviço, sem margem de impressão
  arteFinalCriacao?: number; // € criação de raiz
  arteFinalAdaptacao?: number; // € adaptação/alteração de ficheiro existente
  // pagamento
  entidadeMB: string;
  chaveMB: string;
  mbwayNumero?: string; // número para pagamento MB WAY
  // documento / condições de venda (editáveis — verso do orçamento)
  percentagemAdjudicacao?: number; // 0..100
  condicoesVenda?: string; // texto livre do verso (aberto para acrescentar/editar)
  // quantidades sugeridas para a tabela de preços
  quantidadesTabela: number[];
  // aparência do PDF (cores, textos, cabeçalho) — opcional
  aparenciaPdf?: AparenciaPdf;
  // configuração de stickers / autocolantes — opcional
  stickers?: StickersConfig;
  // configuração de Imp. Pequeno Formato (flyers) — opcional
  flyers?: FlyersConfig;
  // configuração de Vinil (Grande Formato) — opcional
  vinil?: VinilConfig;
  // catálogo de artigos/acessórios (distanciadores, fitas dupla face, etc.) — opcional
  artigos?: ArtigoConfig[];
}

// ---- Valores derivados (calculados a partir da config) ----
export interface CustosDerivados {
  amortMensalTotal: number;
  custoFixoMes: number;
  horasUteisMes: number;
  horasProdutivasMes: number; // horasUteisMes × taxaOcupacao
  custoFixoHora: number;
  custoFixoMinuto: number;
  equipamentoHora: Record<string, number>; // nome -> €/hora
  corteFolha: Record<string, number>; // id -> €/folha
  corteSetup: Record<string, number>; // id -> € setup
}

// ---- Stickers / Autocolantes ----
export interface SubstratoStickerConfig {
  id: string; // S1..S12
  descricao: string;
  aplicacao: string; // ex.: 'Vinil Impressão', 'Papel Autoc Laser'
  maquina: 'Mutoh' | 'Xerox';
  larguraMm: number;
  comprimentoMm: number;
  precoRolo: number; // € por rolo/caixa
  folhasCaixa: number; // folhas por caixa (para calcular €/m²)
  categoria?: string; // categoria do catálogo (ver SUBSTRATO_CATEGORIAS)
  unidadeVenda?: string; // como é comprado: 'rolo'|'caixa'|'folha'|'m2' (ver UNIDADES_SUBSTRATO)
  ativo?: boolean; // se false, não aparece no seletor de orçamento (undefined = ativo)
}

export interface FormatoXeroxConfig {
  id: string; // '320x450'
  label: string; // '320 × 450'
  larguraMm: number;
  alturaMm: number;
  custoPapelFolha: number; // € por folha
}

export interface CorteStickerConfig {
  id: string; // igual ao nome (usado como valor selecionável)
  nome: string;
  velocidadeMmS?: number; // mm/s (legado)
  folhasHora?: number; // folhas/passagens por hora (modelo Excel); 0 = sem corte
}

export interface StickersConfig {
  // Mutoh (rolo)
  mutohLarguraRoloMm: number; // 685
  mutohCustoTinteiros: number; // € set de tinteiros (c/IVA)
  mutohCapacidadeTinteiroMl: number; // ml por tinteiro
  mutohConsumoMlM2: number; // ml/m² @100% cobertura
  mutohVelocidadeM2h: number; // m²/h
  mutohRefugo: number; // 0..1
  // Xerox (folha)
  xeroxMargemFolhaMm: number; // margem de folha (também usada na largura Mutoh)
  xeroxGapMm: number; // gap entre stickers
  xeroxVelocidadeFolhasH: number; // folhas/h
  xeroxCliqueCor: number; // €/folha (cor)
  xeroxCliquePB: number; // €/folha (P&B)
  fatorPB: number; // fator de tinta P&B (0..1)
  formatosXerox: FormatoXeroxConfig[];
  // Laminação
  laminacaoMutohM2: number; // €/m² (rolo)
  laminacaoXeroxFolha: number; // €/folha
  // Opções de laminação (Excel 'Dados Base' — STICKERS ADESIVOS): Nenhuma + Mate/Brilho
  laminacoes?: LaminacaoStickerConfig[];
  // Corte
  cortes: CorteStickerConfig[];
  // Margem comercial (legado — modelo Excel usa faixasMargem por quantidade)
  margemComercial: number; // ex.: 1.5
  // Substratos disponíveis
  substratos: SubstratoStickerConfig[];
  // Setup / pré-impressão (legado)
  setupMin: number; // minutos fixos de setup
  // Modelo Excel: área de uma passagem de corte em rolo (cm²) — 7000
  areaPassagemCm2?: number;
}

export interface LaminacaoStickerConfig {
  id: string; // ex.: 'LP2812M', 'LP2812G'
  nome: string; // rótulo apresentado
  tipo?: string; // 'Mate' | 'Brilho'
  precoM2: number; // €/m²
}

export interface StickersInput {
  larguraMm: number;
  alturaMm: number;
  sangriaMm: number; // bleed por lado
  coberturaTinta: number; // 0..1
  cor: boolean; // true = cores, false = P&B
  substratoId: string; // S1..S12
  aplicacao?: string;
  tipoCorte: string; // id/nome do corte (velocidade)
  laminacao: boolean; // com/sem laminação (legado)
  laminacaoId?: string; // id da laminação escolhida ('' = Nenhuma)
  maquinaModo?: 'auto' | 'mutoh' | 'xerox'; // via de produção: automática (mais barata), forçar Mutoh (rolo) ou forçar Versant (folha)
}

// ---- Entrada específica de Contratar (Subcontratação) ----
// O preço é definido a partir do custo do fornecedor + uma % de margem.
export interface ContratarInput {
  descricao: string; // descrição do trabalho subcontratado
  fornecedor?: string; // nome do fornecedor (opcional)
  custoUnitario: number; // custo do fornecedor por unidade (€)
  markup: number; // margem aplicada como fração (ex.: 0.4 = 40%)
}

// ---- Produto em Branco (texto livre) ----
// Linha totalmente manual: descrição livre + preço unitário (s/IVA).
export interface LivreInput {
  descricao: string;
  precoUnitario: number;
}

// ---- Imp. Pequeno Formato (Flyers / Folhetos) ----
export interface FlyerPapelConfig {
  id: string; // P5..P11
  tipo: string; // ex.: 'Couché Brilho'
  gramagem: number;
  larguraMm: number;
  alturaMm: number;
  custoResma: number; // € por resma
  folhasResma: number; // folhas por resma
}

export interface FlyerAcabamentoConfig {
  id: string;
  nome: string;
  custoUn: number; // € por folha/unidade consoante o modelo
  setup: number; // € custo fixo de setup
  // porFolha: setup + folhas × custoUn
  // porUnidade: setup + qtd × custoUn
  // porFolhaLado: setup + folhas × custoUn × (frenteVerso ? 2 : 1)
  modelo: 'porFolha' | 'porUnidade' | 'porFolhaLado';
}

// Operações de acabamento com modelo do Excel (Calculadora Flyers)
export interface FlyerOperacoesConfig {
  corteCustoFolha: number; // € por folha (guilhotina)
  corteSetup: number; // € setup fixo
  vincoCustoUnidade: number; // € por unidade (flyer)
  vincoSetup: number; // € setup fixo
  dobraCustoUnidade: number; // € por unidade (flyer)
  dobraSetup: number; // € setup fixo
}

export interface FlyersConfig {
  papeis: FlyerPapelConfig[];
  acabamentos: FlyerAcabamentoConfig[];
  operacoes?: FlyerOperacoesConfig; // corte/vinco/dobra (modelo Excel)
  margens: FaixaMargem[]; // legado — modelo Excel usa faixasMargem globais por quantidade
  bleedMm: number; // sangria por lado (mm)
}

export interface FlyersInput {
  papelId: string;
  formato: string; // 'A4' | 'A5' | 'A6' | 'DL' | 'Personalizado'
  larguraMm: number;
  alturaMm: number;
  frenteVerso: boolean;
  corFrente: boolean; // true = cor, false = P&B
  corVerso: boolean;
  tipoFlyer?: string; // 'monofolha' | 'diptico' | 'triptico'
  corteGuilhotina?: boolean; // corte reto em guilhotina (default true)
  vincar?: boolean; // vincar antes de dobrar (só relevante se não monofolha)
  acabamentos: string[]; // ids de acabamentos ativos (laminação/furação)
}

// ---- Vinil / Grande Formato (Mutoh XpertJet 1641SR Pro + Graphtec CE7000) ----
export interface VinilSubstratoConfig {
  id: string; // S1..S32
  descricao: string;
  aplicacao: string; // 'Laminação','Lona','Microperfurado','Sinaletica','Vinil impressão','Vinil de corte','Pelicula de Trans','Vinil de impresso e recortado','Vinil de corte fosco','Vinil Fosco'
  larguraMm: number;
  comprimentoMm: number; // comprimento do rolo
  precoRolo: number; // € por rolo
  precoM2: number; // € por m² (preço rolo / área do rolo)
  categoria?: string; // categoria do catálogo (ver SUBSTRATO_CATEGORIAS)
  unidadeVenda?: string; // como é comprado: 'rolo'|'caixa'|'folha'|'m2' (ver UNIDADES_SUBSTRATO)
  ativo?: boolean; // se false, não aparece no seletor de orçamento (undefined = ativo)
}

// ---- Artigos / Acessórios (linha somável no orçamento) ----
// Materiais que NÃO passam por um motor de impressão: distanciadores (unidade/kit),
// fitas dupla face (metro linear), etc. O preço é custo unitário × quantidade × (1 + margem).
export interface ArtigoConfig {
  id: string; // A1, A2, ...
  descricao: string;
  categoria?: string; // categoria do catálogo (ver SUBSTRATO_CATEGORIAS)
  unidade?: string; // 'un'|'kit'|'metro' (ver UNIDADES_ARTIGO)
  custoUnitario: number; // € por unidade/kit/metro
  markup: number; // margem como fração (ex.: 0.4 = 40%)
  ativo?: boolean; // se false, não aparece no seletor de orçamento (undefined = ativo)
}

export interface ArtigoInput {
  artigoId?: string; // id do artigo escolhido no catálogo (opcional)
  descricao: string;
  unidade?: string; // 'un'|'kit'|'metro'
  custoUnitario: number; // € por unidade
  markup: number; // margem como fração
}

export interface VinilMargemFaixa {
  areaM2: number; // m² a partir de
  margem: number; // markup (preço = custo × (1 + margem))
}

export interface VinilLaminacaoConfig {
  id: string;
  nome: string;
  larguraMm: number; // largura do rolo de laminação
  precoM2: number; // €/m²
}

export interface VinilConfig {
  substratos: VinilSubstratoConfig[];
  margens: VinilMargemFaixa[]; // legado — modelo Excel usa faixasMargem globais por quantidade
  // ---- Modelo Excel ----
  laminacoes?: VinilLaminacaoConfig[];
  aplicacaoSubstratoM2?: number; // €/m² aplicação no substrato/suporte (5)
  ilhosCustoUn?: number; // € por ilhó (0.25)
  ilhosPassoMm?: number; // espaçamento entre ilhoses ao longo do perímetro (mm)
  biadesivoMetro?: number; // € por metro de biadesivo (1.5)
  // Mutoh XpertJet 1641SR Pro (impressão)
  mutohCustoTinteiros: number; // € set de tinteiros (c/IVA)
  mutohCapacidadeTinteiroMl: number; // ml por tinteiro
  mutohConsumoMlM2: number; // ml/m² @100% cobertura
  mutohVelocidadeM2h: number; // m²/h
  mutohRefugo: number; // 0..1
  bleedMm: number; // sangria por lado (mm)
  coberturaTintaDefault: number; // 0..1 (predefinição)
  // Recorte (Graphtec CE7000-130)
  recorteCustoM2: number; // €/m²
  recorteDescasqueM2: number; // €/m² (descasque/weeding)
  recorteAplicPeliculaM2: number; // €/m² (aplicação de película de transporte)
  recorteCodPeliculaTransporte: string; // código do substrato de película (ex.: 'S19')
  recorteVelocidadeM2h: number; // m²/h
  // Acabamentos simples (quando não há recorte)
  acabamentoApenasCorteM2: number; // €/m²
  acabamentoIlhosPassoM: number; // espaçamento entre ilhós (m)
  acabamentoIlhosCustoUn: number; // € por ilhó
  acabamentoLaminadoAntiUvM2: number; // €/m²
  acabamentoAplicacaoSuporteM2: number; // €/m²
  setupMin: number; // minutos fixos de pré-impressão + setup
  // Aplicação no local (deslocação + mão de obra)
  aplicDistanciaKm: number; // km ida+volta
  aplicNumFuncionarios: number;
  aplicTempoHoras: number;
  aplicCustoKm: number; // €/km
  aplicCustoMaoObraHora: number; // €/hora
  aplicMargem: number; // markup sobre o custo de aplicação
}

export interface VinilInput {
  larguraMm: number;
  alturaMm: number;
  bleedMm: number;
  coberturaTinta: number; // 0..1
  substratoId: string; // S1..S32
  aplicacao?: string; // 'Indoor' | 'Outdoor' (informativo)
  acabamento: string; // 'Apenas corte' | 'Corte + ilhós' | 'Laminado anti-UV' | 'Aplicação no suporte' | 'Nenhum'
  aplicacaoNoLocal: boolean;
  imprimir: boolean;
  margemOverride?: number | null; // vazio/null = automático por quantidade
  // ---- Modelo Excel ----
  nCores?: number; // n.º de cores (1..4) — tinta = área × nCores/4 × €/m²
  laminacaoId?: string; // '' = sem laminação
  recorteContorno?: boolean;
  pelicula?: boolean; // aplicação de película de transporte (recorte)
  aplicacaoSubstrato?: boolean; // aplicação no substrato/suporte
  suporteRigidoId?: string; // placa rígida de suporte ('' = nenhum)
  nIlhoses?: number;
  metrosBiadesivo?: number;
  ilhoses?: boolean; // auto: 1 ilhó a cada ilhosPassoMm ao longo do perímetro × quantidade
  biadesivo?: boolean; // auto: metros lineares = perímetro × quantidade
  aplicKm?: number;
  aplicFuncionarios?: number;
  aplicHoras?: number;
}

// ---- Entrada específica de Cartões ----
export interface CartoesInput {
  papelId: string;
  larguraMm: number; // dimensão do cartão
  alturaMm: number;
  sangriaMm: number;
  frenteVerso: boolean;
  cor: boolean; // true = cor, false = P&B
  tipoCorte: string; // id de corte ou 'nenhum'
  vinco: boolean;
  laminacoes: string[]; // ids de laminações ativas
}

// ---- Aproveitamento do rolo (grande formato) ----
export interface AproveitamentoRolo {
  placa: boolean; // true = placa rígida (faturado por área da peça, não por rolo)
  larguraRoloMm: number;
  orientacao: string; // 'Direita' | 'Rodada' | '—'
  pecasPorLargura: number; // peças que cabem ao longo da largura do rolo
  compRoloM: number; // comprimento de rolo consumido (m)
  areaPecasM2: number; // área real das peças (m²)
  areaRoloM2: number; // área de rolo consumida (largura × comprimento) (m²)
  aproveitamentoPct: number; // 0..1 = área real / área de rolo consumida
  baseFaturacao: string; // 'Metro linear (rolo)' | 'Área da peça (placa)'
  precoPorM2: number; // preço s/IVA por m² de peça
  precoPorMetroLinear: number; // preço s/IVA por metro linear de rolo
}

// ---- Resultado ----
export interface ComponenteCusto {
  chave: string;
  label: string;
  valor: number;
}

export interface LinhaTabelaPreco {
  quantidade: number;
  folhas: number;
  custoPapel: number;
  custoImpressao: number;
  custoPreImp: number;
  custoCorte: number;
  custoVinco: number;
  custoLaminacoes: number;
  custoTotal: number;
  margem: number;
  precoSemIva: number;
  precoComIva: number;
  precoUnitario: number;
}

export interface ResultadoOrcamento {
  produto: string;
  quantidade: number;
  // imposição
  cartoesPorFolha: number;
  aproveitamento: number;
  orientacao: string;
  // (stickers) opção de produção escolhida e info de folhas — opcional
  opcaoProducao?: string;
  folhasInfo?: string;
  // (grande formato) aproveitamento do rolo — opcional
  aproveitamentoRolo?: AproveitamentoRolo;
  // componentes para a quantidade escolhida
  folhas: number;
  componentes: ComponenteCusto[];
  custoTotal: number;
  margem: number;
  descontoCliente: number;
  sobretaxa24h: number;
  precoSemIva: number;
  precoComIva: number;
  precoUnitario: number;
  abaixoMargemMinima: boolean;
  // tabela por quantidade
  tabela: LinhaTabelaPreco[];
}

export interface ProdutoCalculator {
  id: string;
  label: string;
  calcular: (
    input: any,
    quantidade: number,
    config: GraficaConfig,
    derivados: CustosDerivados,
    opcoes: { tipoCliente: string; entrega24h: boolean; descontoManual?: number | null; ivaZero?: boolean }
  ) => ResultadoOrcamento;
}
