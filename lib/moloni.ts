// Moloni API Integration

const MOLONI_API_BASE = 'https://api.moloni.pt/v1';

interface MoloniTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let cachedTokens: MoloniTokens | null = null;

export async function getMoloniAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedTokens && cachedTokens.expires_at > Date.now() + 60000) {
    return cachedTokens.access_token;
  }

  const clientId = process.env.MOLONI_CLIENT_ID;
  const clientSecret = process.env.MOLONI_CLIENT_SECRET;
  const username = process.env.MOLONI_USERNAME;
  const password = process.env.MOLONI_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Credenciais do Moloni não configuradas. Configure MOLONI_CLIENT_ID, MOLONI_CLIENT_SECRET, MOLONI_USERNAME e MOLONI_PASSWORD.');
  }

  // Try refresh token first
  if (cachedTokens?.refresh_token) {
    try {
      const res = await fetch(`${MOLONI_API_BASE}/grant/?grant_type=refresh_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(cachedTokens.refresh_token)}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          cachedTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || cachedTokens.refresh_token,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000,
          };
          return cachedTokens.access_token;
        }
      }
    } catch (e) {
      console.log('Refresh token failed, trying password grant...');
    }
  }

  // Password grant
  const res = await fetch(`${MOLONI_API_BASE}/grant/?grant_type=password&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha na autenticação Moloni: ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Resposta inválida do Moloni: ${JSON.stringify(data)}`);
  }

  cachedTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedTokens.access_token;
}

export async function moloniRequest(endpoint: string, body: Record<string, any> = {}) {
  const token = await getMoloniAccessToken();
  const url = `${MOLONI_API_BASE}/${endpoint}/?access_token=${encodeURIComponent(token)}`;

  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      formBody.append(key, String(value));
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Moloni API error (${endpoint}): ${res.status} - ${errText}`);
  }

  return res.json();
}

// Get company ID
export async function getMoloniCompanyId(): Promise<number> {
  // Use configured company ID if available
  const configuredId = process.env.MOLONI_COMPANY_ID;
  if (configuredId) {
    return parseInt(configuredId, 10);
  }

  // Fallback: fetch from API and prefer non-demo companies
  const companies = await moloniRequest('companies/getAll');
  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error('Nenhuma empresa encontrada no Moloni');
  }
  
  // If multiple companies, skip the demo company (ID 5)
  const realCompanies = companies.filter((c: any) => c.company_id !== 5);
  if (realCompanies.length > 0) {
    return realCompanies[0].company_id;
  }
  
  return companies[0].company_id;
}

// ---- CUSTOMERS ----
export async function getMoloniCustomers(companyId: number, offset = 0, qty = 50) {
  return moloniRequest('customers/getAll', { company_id: companyId, qty, offset });
}

export async function getMoloniCustomerCount(companyId: number) {
  return moloniRequest('customers/count', { company_id: companyId });
}

// ---- SUPPLIERS ----
export async function getMoloniSuppliers(companyId: number, offset = 0, qty = 50) {
  return moloniRequest('suppliers/getAll', { company_id: companyId, qty, offset });
}

export async function getMoloniSupplierCount(companyId: number) {
  return moloniRequest('suppliers/count', { company_id: companyId });
}

// ---- DOCUMENTS ----
const DOC_TYPES = [
  { endpoint: 'invoices', label: 'Faturas', saftCode: 'FT' },
  { endpoint: 'invoiceReceipts', label: 'Faturas-Recibo', saftCode: 'FR' },
  { endpoint: 'simplifiedInvoices', label: 'Faturas Simplificadas', saftCode: 'FS' },
  { endpoint: 'creditNotes', label: 'Notas de Crédito', saftCode: 'NC' },
  { endpoint: 'debitNotes', label: 'Notas de Débito', saftCode: 'ND' },
  { endpoint: 'receipts', label: 'Recibos', saftCode: 'RC' },
  { endpoint: 'estimates', label: 'Orçamentos', saftCode: 'OR' },
  { endpoint: 'deliveryNotes', label: 'Guias de Remessa', saftCode: 'GR' },
  { endpoint: 'billsOfLading', label: 'Guias de Transporte', saftCode: 'GT' },
  { endpoint: 'waybills', label: 'Guias de Envio', saftCode: 'GE' },
] as const;

export { DOC_TYPES };

export async function getMoloniDocuments(companyId: number, docType: string, offset = 0, qty = 50) {
  return moloniRequest(`${docType}/getAll`, { company_id: companyId, qty, offset });
}

export async function getMoloniDocumentCount(companyId: number, docType: string) {
  return moloniRequest(`${docType}/count`, { company_id: companyId });
}

// ---- PUSH TO MOLONI ----
export async function createMoloniCustomer(companyId: number, data: {
  name: string;
  vat: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  return moloniRequest('customers/insert', {
    company_id: companyId,
    name: data.name,
    vat: data.vat || '999999990',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    country_id: 1, // Portugal
    language_id: 1,
    maturity_date_id: 0,
    payment_method_id: 0,
  });
}

export async function createMoloniSupplier(companyId: number, data: {
  name: string;
  vat: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  return moloniRequest('suppliers/insert', {
    company_id: companyId,
    name: data.name,
    vat: data.vat || '999999990',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    country_id: 1,
    language_id: 1,
    maturity_date_id: 0,
    payment_method_id: 0,
  });
}

// ---- DOCUMENT SETS / TAXES helpers ----
export async function getMoloniDocumentSets(companyId: number) {
  return moloniRequest('documentSets/getAll', { company_id: companyId });
}

export async function getMoloniTaxes(companyId: number) {
  return moloniRequest('taxes/getAll', { company_id: companyId });
}

// Flatten nested objects/arrays into Moloni's bracket notation, e.g. products[0][name]
function appendNested(form: URLSearchParams, key: string, value: any) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendNested(form, `${key}[${i}]`, v));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      appendNested(form, `${key}[${k}]`, v);
    }
  } else {
    form.append(key, String(value));
  }
}

async function moloniRequestNested(endpoint: string, body: Record<string, any> = {}) {
  const token = await getMoloniAccessToken();
  const url = `${MOLONI_API_BASE}/${endpoint}/?access_token=${encodeURIComponent(token)}`;
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    appendNested(form, key, value);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Moloni API error (${endpoint}): ${res.status} - ${errText}`);
  }
  return res.json();
}

export interface MoloniDraftProduct {
  name: string;
  qty: number;
  price: number; // preço unitário sem IVA
  taxId?: number; // id do imposto (IVA)
  taxValue?: number; // percentagem, ex 23
  exemptionReason?: string; // se sem imposto
  discount?: number; // desconto de linha em percentagem (0-100)
}

// O Moloni exige um product_id válido em cada linha de documento. Como os
// orçamentos gráficos são serviços dinâmicos, usamos (ou criamos) um artigo
// genérico de catálogo "Serviços Gráficos" e sobrepomos nome/preço por linha.
let cachedGenericProductId: number | null = null;
export async function getOrCreateMoloniProduct(companyId: number, taxId?: number): Promise<number> {
  if (cachedGenericProductId) return cachedGenericProductId;
  const REF = 'SERVGRAF';

  // 0) LÓGICA POR product_id: se estiver definido MOLONI_PRODUCT_ID no ambiente,
  //    usamos esse artigo diretamente (evita pesquisar em milhares de artigos).
  //    Validamos que o artigo existe mesmo antes de o usar como cache.
  const envProductId = Number(process.env.MOLONI_PRODUCT_ID || 0);
  if (envProductId > 0) {
    const existe = await moloniRequest('products/getOne', { company_id: companyId, product_id: envProductId }).catch(() => null);
    const prodObj = Array.isArray(existe) ? existe[0] : existe;
    if (prodObj?.product_id) {
      cachedGenericProductId = prodObj.product_id;
      return prodObj.product_id;
    }
    // Se o id configurado não existir, seguimos para a pesquisa/criação normal.
  }

  // 1) procurar artigo já existente com esta referência.
  //    ATENÇÃO: o catálogo pode ter milhares de artigos, por isso NUNCA usar
  //    products/getAll com offset 0 (só vê os primeiros 50). Usamos a pesquisa
  //    por referência exata, que percorre todo o catálogo.
  const buscarPorRef = async (): Promise<any | null> => {
    // getByReference (referência exata)
    const porRef = await moloniRequest('products/getByReference', { company_id: companyId, reference: REF }).catch(() => null);
    if (Array.isArray(porRef)) {
      const m = porRef.find((p) => p?.reference === REF);
      if (m?.product_id) return m;
    }
    // fallback: getBySearch (pesquisa textual)
    const porSearch = await moloniRequest('products/getBySearch', { company_id: companyId, search: REF }).catch(() => null);
    if (Array.isArray(porSearch)) {
      const m = porSearch.find((p) => p?.reference === REF);
      if (m?.product_id) return m;
    }
    return null;
  };
  const encontrado = await buscarPorRef();
  if (encontrado?.product_id) {
    cachedGenericProductId = encontrado.product_id;
    return encontrado.product_id;
  }

  // 2) determinar categoria e unidade
  let categoryId: number | undefined;
  let unitId = 1114344; // "Unidade" (fallback comum)
  const cats = await moloniRequest('productCategories/getAll', { company_id: companyId, parent_id: 0 }).catch(() => []);
  if (Array.isArray(cats) && cats.length) categoryId = cats[0].category_id;
  const amostra = await moloniRequest('products/getAll', { company_id: companyId, qty: 1, offset: 0 }).catch(() => []);
  if (!categoryId && Array.isArray(amostra) && amostra.length) {
    categoryId = amostra[0].category_id;
    if (amostra[0].unit_id) unitId = amostra[0].unit_id;
  }
  if (!categoryId) {
    const novaCat = await moloniRequestNested('productCategories/insert', {
      company_id: companyId,
      name: 'Serviços Gráficos',
      parent_id: 0,
    });
    categoryId = novaCat?.category_id;
  }

  // 3) criar o artigo genérico (tipo 2 = serviço, sem stock)
  const prod: any = {
    company_id: companyId,
    category_id: categoryId,
    type: 2,
    name: 'Serviços Gráficos',
    reference: REF,
    price: 0,
    unit_id: unitId,
    has_stock: 0,
  };
  // O Moloni exige imposto OU motivo de isenção válido no artigo.
  if (taxId) {
    prod.taxes = [{ tax_id: taxId, order: 1, cumulative: 0 }];
  } else {
    prod.exemption_reason = 'M99'; // isento (código genérico aceite pelo Moloni)
  }
  const criado = await moloniRequestNested('products/insert', prod);
  if (criado?.product_id) {
    cachedGenericProductId = criado.product_id;
    return criado.product_id;
  }
  // Se a criação falhou por referência duplicada, o artigo já existe — procura de novo.
  const jaExiste = await buscarPorRef();
  if (jaExiste?.product_id) {
    cachedGenericProductId = jaExiste.product_id;
    return jaExiste.product_id;
  }
  const detalhe = Array.isArray(criado) ? criado.join(', ') : JSON.stringify(criado);
  throw new Error(`Não foi possível criar o artigo genérico no Moloni: ${detalhe}`);
}

// Cria uma FATURA em rascunho (status 0) no Moloni. Best-effort.
export async function createMoloniDraftInvoice(companyId: number, data: {
  customerId: number;
  documentSetId: number;
  products: MoloniDraftProduct[];
  notes?: string;
  ourReference?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  // O Moloni requer um product_id válido em cada linha.
  const taxIdLinha = data.products.find((p) => p.taxId)?.taxId;
  const productId = await getOrCreateMoloniProduct(companyId, taxIdLinha);
  const products = data.products.map((p) => {
    const prod: any = {
      product_id: productId,
      name: p.name,
      qty: p.qty,
      price: p.price,
    };
    if (p.discount && p.discount > 0) {
      prod.discount = Math.round(p.discount * 100) / 100;
    }
    if (p.taxId) {
      prod.taxes = [{ tax_id: p.taxId, order: 1, cumulative: 0 }];
    } else if (p.exemptionReason) {
      prod.exemption_reason = p.exemptionReason;
    }
    return prod;
  });

  return moloniRequestNested('invoices/insert', {
    company_id: companyId,
    date: today,
    expiration_date: today,
    document_set_id: data.documentSetId,
    customer_id: data.customerId,
    status: 0, // rascunho
    our_reference: data.ourReference || '',
    notes: data.notes || '',
    products,
  });
}
