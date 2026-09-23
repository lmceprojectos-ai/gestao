import { GraficaConfig } from './types';

// Configuração padrão — valores extraídos da folha de cálculo original.
// Todos os valores são editáveis na página de configurações do módulo.
export const configGraficaDefault: GraficaConfig = {
  velocidadeImpressao: 80, // folhas/min (Versant 280)
  preImpMin: 5, // minutos de pré-impressão por trabalho
  cliqueCor: 0.06396, // € por clique (cor) — Versant 280
  cliquePB: 0.01196, // € por clique (P&B) — Excel CRIAORCAMENTOS v3
  refugoPapel: 0, // legado — não usado no modelo Excel
  refugoImpressao: 0.08, // legado — não usado no modelo Excel
  // ---- Modelo Excel (CRIAORCAMENTOS v3) ----
  overheadPct: 0.15, // custos indiretos (15% do custo direto)
  custoHoraMaquina: 31.75, // €/hora máquinas de corte/vinco/dobra
  setupCorteEur: 5, // € por setup de corte/vinco
  tintaMutohM2: 1.4, // €/m² tinta Mutoh (4 cores)
  deducaoLarguraMm: 20, // largura útil = folha − 20 mm (Excel)
  perdaAgarreMm: 10, // aplicada 2x na altura (Excel)
  custosFixos: {
    operadorMes: 3120,
    rendaMes: 1250,
    softwareAno: 400,
    segurosAno: 580,
    diasUteisMes: 22,
    horasDia: 8,
    taxaOcupacao: 1,
  },
  equipamentos: [
    { nome: 'Versant 280', investimento: 20000, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Imp. grande formato Mutho', investimento: 16000, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Guilhotina EBA Multicut', investimento: 4200, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Plastificadora A3', investimento: 2500, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Laminadora 1600mm', investimento: 3500, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Máq corte e vinco Bannerjet', investimento: 4000, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Plotter corte Graphtec CE7000', investimento: 5500, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Plotter mesa Evocut', investimento: 6500, amortMeses: 60, horasUsoDia: 2 },
    { nome: 'Morgana Major Folder', investimento: 4000, amortMeses: 60, horasUsoDia: 2 },
  ],
  papeis: [
    { id: 'P12', nome: 'Golden Digital Silk 200gr', gramagem: 200, larguraMm: 330, alturaMm: 480, custoBase: 18.74, margemFornecedor: 0.2, folhasResma: 250, unidadeVenda: 'folha', categoria: 'Cartolinas' },
    { id: 'P3', nome: 'Golden Digital Silk 350gr', gramagem: 350, larguraMm: 330, alturaMm: 487, custoBase: 27.2, margemFornecedor: 0.2, folhasResma: 200, unidadeVenda: 'folha', categoria: 'Cartolinas' },
    { id: 'P1', nome: 'Golden Digital Gloss 350gr', gramagem: 350, larguraMm: 330, alturaMm: 487, custoBase: 28.15, margemFornecedor: 0.2, folhasResma: 200, unidadeVenda: 'folha', categoria: 'Cartolinas' },
    { id: 'P13', nome: 'Couché Mate 400grs', gramagem: 400, larguraMm: 330, alturaMm: 480, custoBase: 64.33, margemFornecedor: 0.2, folhasResma: 400, unidadeVenda: 'folha', categoria: 'Cartolinas' },
    { id: 'P14', nome: 'Cartolina INVERCOTE 300grs', gramagem: 300, larguraMm: 330, alturaMm: 487, custoBase: 22.27, margemFornecedor: 0.2, folhasResma: 125, unidadeVenda: 'folha', categoria: 'Cartolinas' },
    { id: 'P15', nome: 'Cartolina INVERCOTE 330grs', gramagem: 330, larguraMm: 330, alturaMm: 487, custoBase: 23.6, margemFornecedor: 0.2, folhasResma: 125, unidadeVenda: 'folha', categoria: 'Cartolinas' },
  ],
  cortes: [
    { id: 'guilhotina', nome: 'Corte guilhotina', velocidade: 300, setupMin: 5, equipamento: 'Guilhotina EBA Multicut', folhasHora: 500 },
    { id: 'cantos', nome: 'Cantos redondos', velocidade: 300, setupMin: 4, equipamento: 'Máq corte e vinco Bannerjet', folhasHora: 180 },
    { id: 'contorno', nome: 'Corte com contorno', velocidade: 180, setupMin: 8, equipamento: 'Máq corte e vinco Bannerjet', folhasHora: 150 },
    { id: 'vinco', nome: 'Vinco', velocidade: 250, setupMin: 4, equipamento: 'Máq corte e vinco Bannerjet', folhasHora: 130 },
  ],
  laminacoes: [
    { id: 'brilho', nome: 'Laminação brilho', custoFolha: 0.2625, setup: 5 },
    { id: 'mate', nome: 'Laminação mate', custoFolha: 0.2625, setup: 5 },
    { id: 'softtouch', nome: 'Laminação Soft Touch', custoFolha: 0.75, setup: 7.5 },
  ],
  faixasMargem: [
    { quantidade: 50, margem: 0.72 },
    { quantidade: 100, margem: 0.7 },
    { quantidade: 250, margem: 0.66 },
    { quantidade: 500, margem: 0.6 },
    { quantidade: 750, margem: 0.55 },
    { quantidade: 1000, margem: 0.52 },
    { quantidade: 2000, margem: 0.45 },
    { quantidade: 5000, margem: 0.38 },
  ],
  descontosCliente: [
    { tipo: 'novo', label: 'Cliente Novo', desconto: 0 },
    { tipo: 'frequente', label: 'Cliente Frequente', desconto: 0.1 },
    { tipo: 'revenda', label: 'Revenda', desconto: 0.2 },
  ],
  sobretaxa24h: 0.35,
  margemMinima: 0.5,
  iva: 0.23,
  arteFinalCriacao: 25, // € — criação de arte-final de raiz
  arteFinalAdaptacao: 10, // € — adaptação/alteração de ficheiro existente
  entidadeMB: '',
  chaveMB: 'LRJ-708379',
  mbwayNumero: '914 358 882',
  percentagemAdjudicacao: 50,
  condicoesVenda: `1. Orçamento e validade — O presente orçamento é válido por 8 dias a contar da data de emissão. Os preços são apresentados em euros e acrescidos de IVA à taxa legal em vigor (23%).

2. Adjudicação e pagamento — A adjudicação é confirmada por escrito. Salvo acordo diferente, o pagamento é de 0% no adiantamento e 100% no levantamento/entrega. A produção só se inicia após confirmação da encomenda e do respetivo adiantamento.

3. Arte-final e provas — Os ficheiros devem ser entregues em CMYK, 300 dpi e com 3 mm de sangria. A produção só avança após aprovação da prova pelo cliente. Erros existentes em arte-final aprovada são da responsabilidade do cliente.

4. Prazos de entrega — Os prazos (habitualmente 2 a 5 dias úteis após aprovação da prova) são indicativos e podem variar consoante a complexidade do trabalho e a carga de produção.

5. Cores e acabamentos — Podem ocorrer ligeiras variações de cor entre o visualizado em ecrã e o resultado impresso, bem como pequenas tolerâncias de corte e acabamento, que não constituem defeito.

6. Propriedade e direitos — O cliente declara deter os direitos sobre textos, imagens e marcas fornecidos. Os ficheiros técnicos de produção permanecem propriedade da Criaconsensos, salvo acordo em contrário.

7. Cancelamentos — O cancelamento após o início da produção implica o pagamento do trabalho e materiais já executados.

8. Reclamações — Eventuais reclamações devem ser comunicadas por escrito no prazo de 8 dias após a entrega.

9. Proteção de dados (RGPD) — Os dados pessoais são tratados apenas para a gestão da relação comercial. Pode exercer os seus direitos através de suporteweb@kh4.pt.

10. Foro — Aplica-se a lei portuguesa, sendo competente o foro da comarca do Barreiro, com expressa renúncia a qualquer outro.`,
  quantidadesTabela: [100, 250, 500, 1000, 2000, 5000],
  aparenciaPdf: {
    cores: {
      OC: { bar: '#f5b301', barText: '#1a1a1a', tint: '#fef3c7', accent: '#1d4ed8' },
      ONF: { bar: '#3b82f6', barText: '#ffffff', tint: '#dbeafe', accent: '#1e40af' },
      OL: { bar: '#6b7280', barText: '#ffffff', tint: '#eceef1', accent: '#374151' },
    },
    textos: {
      colDescricao: 'Descrição',
      colQtd: 'Qtd.',
      colPrecoUnit: 'Preço unit. (€)',
      colPrecoTotal: 'Preço bruto s/IVA (€)',
      labelProducao: 'Produção',
      prazoNormal: '4-5 dias úteis',
      labelSubtotal: 'Subtotal s/IVA',
      labelTotalComIva: 'TOTAL c/IVA',
      labelTotalSemIva: 'TOTAL (s/IVA)',
      tituloCondicoes: 'CONDIÇÕES GERAIS DE VENDA',
    },
    cabecalhoDataUri: '',
  },
  stickers: {
    // Mutoh (rolo)
    mutohLarguraRoloMm: 685,
    mutohCustoTinteiros: 585.37,
    mutohCapacidadeTinteiroMl: 1000,
    mutohConsumoMlM2: 12,
    mutohVelocidadeM2h: 15,
    mutohRefugo: 0.05,
    // Xerox (folha)
    xeroxMargemFolhaMm: 6,
    xeroxGapMm: 2,
    xeroxVelocidadeFolhasH: 2400,
    xeroxCliqueCor: 0.08,
    xeroxCliquePB: 0.01,
    fatorPB: 0.25,
    formatosXerox: [
      { id: '320x450', label: '320 × 450', larguraMm: 320, alturaMm: 450, custoPapelFolha: 0.35 },
      { id: '330x487', label: '330 × 487', larguraMm: 330, alturaMm: 487, custoPapelFolha: 0.4 },
    ],
    // Laminação
    laminacaoMutohM2: 3, // €/m² (Excel)
    laminacaoXeroxFolha: 0.25,
    // Opções de laminação (Excel 'Dados Base' — STICKERS ADESIVOS): 102,75 € / (68,5×5000 cm) = 0,0003 €/cm² = 3 €/m²
    laminacoes: [
      { id: 'LP2812M', nome: 'Mate (LP2812M HighVision 70µ)', tipo: 'Mate', precoM2: 3 },
      { id: 'LP2812G', nome: 'Brilho (LP2812G HighVision 70µ)', tipo: 'Brilho', precoM2: 3 },
    ],
    // Corte (modelo Excel: folhas/passagens por hora)
    cortes: [
      { id: 'Nenhum', nome: 'Nenhum', folhasHora: 0 },
      { id: 'Corte reto (guilhotina)', nome: 'Corte reto (guilhotina)', folhasHora: 500 },
      { id: 'Corte e vinco', nome: 'Corte e vinco', folhasHora: 130 },
      { id: 'Cantos redondos', nome: 'Cantos redondos', folhasHora: 180 },
      { id: 'Recorte personalizado', nome: 'Recorte personalizado', folhasHora: 150 },
    ],
    areaPassagemCm2: 7000, // área de uma passagem de corte em rolo (Excel)
    // Margem comercial (markup)
    margemComercial: 1.5,
    // Setup / pré-impressão
    setupMin: 15,
    // Substratos
    substratos: [
      { id: 'S1', descricao: 'LP2812G HighVision 70µ Monomeric Clear Gloss PCA', aplicacao: 'Laminação', maquina: 'Mutoh', larguraMm: 685, comprimentoMm: 50000, precoRolo: 102.75, folhasCaixa: 1 },
      { id: 'S2', descricao: 'LP2812M HighVision 70µ Monomeric Clear Matt PCA', aplicacao: 'Laminação', maquina: 'Mutoh', larguraMm: 685, comprimentoMm: 50000, precoRolo: 102.75, folhasCaixa: 1 },
      { id: 'S3', descricao: 'LD2800G Hausy2800 100µ White Gloss PCA', aplicacao: 'Vinil Impressão', maquina: 'Mutoh', larguraMm: 685, comprimentoMm: 50000, precoRolo: 102.75, folhasCaixa: 1 },
      { id: 'S4', descricao: 'LD2800M Hausy2800 100µ White Matt PCA', aplicacao: 'Vinil Impressão', maquina: 'Mutoh', larguraMm: 685, comprimentoMm: 50000, precoRolo: 102.75, folhasCaixa: 1 },
      { id: 'S5', descricao: 'Vinil Digital Laser 90Gr 33x48,7 Gloss S/Corte Perm. - 250Folhas/Pacote', aplicacao: 'Vinil Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 250 },
      { id: 'S6', descricao: 'Vinil Digital Laser 90Gr 33x48,7 Mate S/Cortes Perm. - 250Folhas/Pacote', aplicacao: 'Vinil Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 250 },
      { id: 'S7', descricao: 'Adhoc Digital Vellum Extra S/C 33X48.7 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 400 },
      { id: 'S8', descricao: 'Adhoc Digital Cast Mate S/C 33X48.7 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 400 },
      { id: 'S9', descricao: 'Adhoc Digital Cast Mate S/C 32X45 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 320, comprimentoMm: 450, precoRolo: 148.6, folhasCaixa: 400 },
      { id: 'S10', descricao: 'Adhoc Digital Cast Mate C/C 33X48.7 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 400 },
      { id: 'S11', descricao: 'Adhoc Digital Cast Coated C/C 33X48.7 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 400 },
      { id: 'S12', descricao: 'Adhoc Digital Cast Coated S/C 33X48.7 Perm.-Mc 400 Folhas', aplicacao: 'Papel Autoc Laser', maquina: 'Xerox', larguraMm: 330, comprimentoMm: 487, precoRolo: 148.6, folhasCaixa: 400 },
    ],
  },
  flyers: {
    // Papéis disponíveis para Imp. Pequeno Formato — exatamente os 5 do Excel (Dados Base, Calculadora Flyers)
    papeis: [
      { id: 'P16', tipo: 'Papel IOR', gramagem: 120, larguraMm: 320, alturaMm: 450, custoResma: 17.72, folhasResma: 500 },
      { id: 'P17', tipo: 'Papel IOR', gramagem: 135, larguraMm: 330, alturaMm: 487, custoResma: 31.51, folhasResma: 500 },
      { id: 'P18', tipo: 'Golden Digital Silk', gramagem: 115, larguraMm: 330, alturaMm: 487, custoResma: 21.63, folhasResma: 500 },
      { id: 'P19', tipo: 'Golden Digital Silk', gramagem: 135, larguraMm: 330, alturaMm: 487, custoResma: 25.39, folhasResma: 500 },
      { id: 'P20', tipo: 'Golden Digital Silk', gramagem: 170, larguraMm: 330, alturaMm: 487, custoResma: 31.99, folhasResma: 500 },
    ],
    // Corte/vinco/dobra: modelo do Excel (Calculadora Flyers). Corte por folha; vinco e dobra por unidade.
    operacoes: {
      corteCustoFolha: 0.0635,
      corteSetup: 5,
      vincoCustoUnidade: 0.0264583,
      vincoSetup: 5,
      dobraCustoUnidade: 0.0211667,
      dobraSetup: 5,
    },
    // Sem laminação nem furação: este produto (Imp. Pequeno Formato) não usa acabamentos extra.
    acabamentos: [],
    margens: [
      { quantidade: 50, margem: 1.4 },
      { quantidade: 100, margem: 1.1 },
      { quantidade: 250, margem: 0.95 },
      { quantidade: 500, margem: 0.85 },
      { quantidade: 750, margem: 0.75 },
      { quantidade: 1000, margem: 0.65 },
      { quantidade: 2000, margem: 0.55 },
      { quantidade: 5000, margem: 0.4 },
    ],
    bleedMm: 3,
  },
  vinil: {
    // Margens comerciais (markup) por área m² — a partir de
    margens: [
      { areaM2: 0, margem: 1.2 },
      { areaM2: 2, margem: 1.0 },
      { areaM2: 5, margem: 0.85 },
      { areaM2: 10, margem: 0.7 },
      { areaM2: 25, margem: 0.55 },
      { areaM2: 50, margem: 0.45 },
      { areaM2: 100, margem: 0.4 },
      { areaM2: 250, margem: 0.35 },
    ],
    // Mutoh XpertJet 1641SR Pro
    mutohCustoTinteiros: 585.37,
    mutohCapacidadeTinteiroMl: 1000,
    mutohConsumoMlM2: 12,
    mutohVelocidadeM2h: 15,
    mutohRefugo: 0.05,
    bleedMm: 5,
    coberturaTintaDefault: 0.9,
    // Recorte (Graphtec CE7000-130)
    recorteCustoM2: 2.25,
    recorteDescasqueM2: 1.75,
    recorteAplicPeliculaM2: 1.75,
    recorteCodPeliculaTransporte: 'S19',
    recorteVelocidadeM2h: 10,
    // Acabamentos simples
    acabamentoApenasCorteM2: 0.5,
    acabamentoIlhosPassoM: 0.3,
    acabamentoIlhosCustoUn: 0.25,
    acabamentoLaminadoAntiUvM2: 4.5,
    acabamentoAplicacaoSuporteM2: 8,
    setupMin: 15,
    // ---- Modelo Excel ----
    laminacoes: [
      { id: 'LP2812G-1050', nome: 'Laminação LP2812G brilho 1050mm', larguraMm: 1050, precoM2: 1.5 },
      { id: 'LP2812G-1370', nome: 'Laminação LP2812G brilho 1370mm', larguraMm: 1370, precoM2: 1.5 },
      { id: 'LP2812M-1060', nome: 'Laminação LP2812M mate 1060mm', larguraMm: 1060, precoM2: 1.4858 },
    ],
    aplicacaoSubstratoM2: 5, // €/m² aplicação no substrato/suporte
    ilhosCustoUn: 0.25, // € por ilhó
    ilhosPassoMm: 300, // 1 ilhó a cada 30 cm ao longo do perímetro
    biadesivoMetro: 1.5, // € por metro de biadesivo
    // Aplicação no local (predefinições Excel)
    aplicDistanciaKm: 35,
    aplicNumFuncionarios: 2,
    aplicTempoHoras: 0.45,
    aplicCustoKm: 0.4,
    aplicCustoMaoObraHora: 20,
    aplicMargem: 0.2,
    // Substratos disponíveis — grande formato
    substratos: [
      { id: 'S1', descricao: 'LP2812G HighVision 70µ Monomeric Clear Gloss PCA', aplicacao: 'Laminação', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 78.75, precoM2: 1.5 },
      { id: 'S2', descricao: 'LP2812G HighVision 70µ Monomeric Clear Gloss PCA', aplicacao: 'Laminação', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 102.75, precoM2: 1.5 },
      { id: 'S3', descricao: 'LP2812M HighVision 70µ Monomeric Clear Matt PCA', aplicacao: 'Laminação', larguraMm: 1060, comprimentoMm: 50000, precoRolo: 78.75, precoM2: 1.4858490566037736 },
      { id: 'S4', descricao: 'LP2812M HighVision 70µ Monomeric Clear Matt PCA', aplicacao: 'Laminação', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 102.75, precoM2: 1.5 },
      { id: 'S5', descricao: 'OL525G Coatex 440gr White Glossy', aplicacao: 'Lona', larguraMm: 1600, comprimentoMm: 25000, precoRolo: 101.2, precoM2: 2.53 },
      { id: 'S6', descricao: 'OL525G Coatex 440gr White Glossy', aplicacao: 'Lona', larguraMm: 1370, comprimentoMm: 25000, precoRolo: 86.65, precoM2: 2.5299270072992703 },
      { id: 'S7', descricao: 'OL9200 MicroView 150µ White Gloss', aplicacao: 'Microperfurado', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 307.4, precoM2: 5.855238095238095 },
      { id: 'S8', descricao: 'OL9200 MicroView 150µ White Gloss', aplicacao: 'Microperfurado', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 397.3, precoM2: 5.8 },
      { id: 'S9', descricao: 'Soft Film RI-469 photoluminescent', aplicacao: 'Sinalética', larguraMm: 1240, comprimentoMm: 10000, precoRolo: 525.14, precoM2: 42.35 },
      { id: 'S10', descricao: 'Ecotac Vinil mate ou brilho', aplicacao: 'Vinil de corte', larguraMm: 1230, comprimentoMm: 10000, precoRolo: 56.83, precoM2: 4.620325203252032 },
      { id: 'S14', descricao: 'LD2800G Hausy2800 100µ White Gloss PCA', aplicacao: 'Vinil impressão', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 102.75, precoM2: 1.5 },
      { id: 'S15', descricao: 'LD2800G Hausy2800 100µ White Gloss PCA', aplicacao: 'Vinil impressão', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 78.75, precoM2: 1.5 },
      { id: 'S16', descricao: 'LD2800M Hausy2800 100µ White Matt PCA', aplicacao: 'Vinil impressão', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 102.75, precoM2: 1.5 },
      { id: 'S17', descricao: 'LD2800M Hausy2800 100µ White Matt PCA', aplicacao: 'Vinil impressão', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 78.75, precoM2: 1.5 },
      { id: 'S18', descricao: 'Ecotac Vinil Ouro Brilho', aplicacao: 'Vinil de corte', larguraMm: 1230, comprimentoMm: 10000, precoRolo: 69.68, precoM2: 5.665040650406504 },
      { id: 'S19', descricao: 'Application Tape White Paper HEX901', aplicacao: 'Película de transporte', larguraMm: 610, comprimentoMm: 100000, precoRolo: 68.32, precoM2: 1.12 },
      { id: 'S20', descricao: 'Application Tape White Paper HEX902', aplicacao: 'Película de transporte', larguraMm: 1220, comprimentoMm: 100000, precoRolo: 136.64, precoM2: 1.12 },
      { id: 'S21', descricao: 'LD2800M Hausy2800 100µ White Matt PCA (impresso e recortado)', aplicacao: 'Vinil de impresso e recortado', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 78.75, precoM2: 1.5 },
      { id: 'S22', descricao: 'LD2800M Hausy2800 100µ White Matt PCA (impresso e recortado)', aplicacao: 'Vinil de impresso e recortado', larguraMm: 1370, comprimentoMm: 50000, precoRolo: 102.75, precoM2: 1.5 },
      { id: 'S24', descricao: 'Luxtac HX5DEPM Hex Press Etched Glass Matt Fosco Bublefree', aplicacao: 'Vinil de corte fosco', larguraMm: 1230, comprimentoMm: 15000, precoRolo: 253.59, precoM2: 13.744715447154473 },
      { id: 'S25', descricao: 'LT5510TM Airfree Etched Glass Deep Silver Matt Bubble Free', aplicacao: 'Vinil de corte fosco', larguraMm: 1220, comprimentoMm: 15000, precoRolo: 138.9, precoM2: 7.590163934426229 },
      { id: 'S26', descricao: 'Hexis Luxtac Etched Glass Frosted Gray S5DEPM Fosco', aplicacao: 'Vinil de corte fosco', larguraMm: 1230, comprimentoMm: 15000, precoRolo: 201.94, precoM2: 10.945257452574525 },
      { id: 'S27', descricao: 'PTA Etched Glass Silver Matt Bubble Free', aplicacao: 'Vinil de corte fosco', larguraMm: 1220, comprimentoMm: 15000, precoRolo: 149.97, precoM2: 8.195081967213115 },
      { id: 'S28', descricao: 'ORACAL 651G — Cinzento Antracite 073', aplicacao: 'Vinil de corte', larguraMm: 1260, comprimentoMm: 1000, precoRolo: 7.01, precoM2: 5.563492063492063 },
      { id: 'S29', descricao: 'ORACAL 651G — Laranja 035', aplicacao: 'Vinil de corte', larguraMm: 1260, comprimentoMm: 1000, precoRolo: 7.01, precoM2: 5.563492063492063 },
      { id: 'S30', descricao: 'ORACAL 651G — Amarelo Girassol 020', aplicacao: 'Vinil de corte', larguraMm: 1260, comprimentoMm: 1000, precoRolo: 7.01, precoM2: 5.563492063492063 },
      { id: 'S31', descricao: 'ORACAL 651G — Preto Brilho 070', aplicacao: 'Vinil de corte', larguraMm: 1260, comprimentoMm: 1000, precoRolo: 6.09, precoM2: 4.833333333333333 },
      { id: 'S32', descricao: 'Fosco Dusted Mate 80mc IP 7803PA', aplicacao: 'Vinil Fosco', larguraMm: 1220, comprimentoMm: 1000, precoRolo: 9.37, precoM2: 7.6803278688524586 },
      { id: 'S11', descricao: 'Foamalux White PVC Espumado 2mm — 3050×2050', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 2050, precoRolo: 38.14, precoM2: 6.1, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S12', descricao: 'Foamalux White PVC Espumado 2mm — 3050×1220', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1220, precoRolo: 22.7, precoM2: 6.1, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S13', descricao: 'Foamalux White PVC Espumado 3mm — 3050×2050', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 2050, precoRolo: 49.39, precoM2: 7.9, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S23', descricao: 'Foamalux White PVC Espumado 3mm — 3050×1560', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1560, precoRolo: 37.59, precoM2: 7.9, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S33', descricao: 'LUXBOND 32 White 102 Brilho (Compósito Alumínio) 3mm — 3050×1500', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1500, precoRolo: 114.15, precoM2: 24.95, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S34', descricao: 'LUXBOND 32 White 102 Matt (Compósito Alumínio) 3mm — 3050×1500', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1500, precoRolo: 114.15, precoM2: 24.95, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S35', descricao: 'LUXBOND 32 White 102 (Compósito Alumínio) — 3050×1500', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1500, precoRolo: 152.2, precoM2: 33.27, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S36', descricao: 'LUXBOND 32 Brushed Silver 001 (Compósito Alumínio) 3mm — 3050×1500', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1500, precoRolo: 142.51, precoM2: 31.15, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S37', descricao: 'Dipac High Perform White PP Multiwall (PP Alveolar) 3mm — 1000×700', aplicacao: 'Placa rígida', larguraMm: 1000, comprimentoMm: 700, precoRolo: 1.61, precoM2: 2.3, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S38', descricao: 'Foamalux White PVC Espumado 5mm — 3050×2050', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 2050, precoRolo: 76.91, precoM2: 12.3, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S39', descricao: 'Simopor SP Black PVC Espumado 3mm — 3050×2050', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 2050, precoRolo: 46.15, precoM2: 7.38, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
      { id: 'S40', descricao: 'Simopor SP Black PVC Espumado 5mm — 3050×1560', aplicacao: 'Placa rígida', larguraMm: 3050, comprimentoMm: 1560, precoRolo: 79.46, precoM2: 16.7, categoria: 'Placas e Suportes Rígidos', unidadeVenda: 'folha', ativo: true },
    ],
  },
  artigos: [
    { id: 'A1', descricao: 'Distanciador de parede inox 13×25 mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 1.2, markup: 0.5 },
    { id: 'A2', descricao: 'Distanciador de parede inox 19×30 mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 1.8, markup: 0.5 },
    { id: 'A3', descricao: 'Kit 4 distanciadores + parafusos', categoria: 'Acessórios de fixação', unidade: 'kit', custoUnitario: 6.5, markup: 0.5 },
    { id: 'A4', descricao: 'Fita dupla face transparente (montagem)', categoria: 'Acessórios de fixação', unidade: 'metro', custoUnitario: 0.9, markup: 0.5 },
    { id: 'A5', descricao: 'Ilhós (olhal) — genérico', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 0.25, markup: 0.5, ativo: true },
    { id: 'A6', descricao: 'Biadesivo (fita dupla-face)', categoria: 'Acessórios de fixação', unidade: 'metro', custoUnitario: 1.5, markup: 0.5, ativo: true },
    { id: 'A7', descricao: 'White Plastic Eyelet Ø12mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 0.09, markup: 0.5, ativo: true },
    { id: 'A8', descricao: '385 White PE Foam Tape 15mm', categoria: 'Acessórios de fixação', unidade: 'metro', custoUnitario: 0.338, markup: 0.5, ativo: true },
    { id: 'A9', descricao: '385 White PE Foam Tape 19mm', categoria: 'Acessórios de fixação', unidade: 'metro', custoUnitario: 0.438, markup: 0.5, ativo: true },
    { id: 'A10', descricao: '385 White PE Foam Tape 50mm', categoria: 'Acessórios de fixação', unidade: 'metro', custoUnitario: 1.138, markup: 0.5, ativo: true },
    { id: 'A11', descricao: 'ScrewFix Steel 13×19mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 2.1, markup: 0.5, ativo: true },
    { id: 'A12', descricao: 'ScrewFix Steel 19×25mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 3.8, markup: 0.5, ativo: true },
    { id: 'A13', descricao: 'ScrewFix Steel 25×25mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 5.9, markup: 0.5, ativo: true },
    { id: 'A14', descricao: 'ScrewFix Aluminium 13×25mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 1.95, markup: 0.5, ativo: true },
    { id: 'A15', descricao: 'ScrewFix Aluminium 19×25mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 2.7, markup: 0.5, ativo: true },
    { id: 'A16', descricao: 'ScrewFix Aluminium 25×25mm', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 3, markup: 0.5, ativo: true },
  ],
};
