// Sistema de permissões POR UTILIZADOR, definido pelo administrador na ficha de
// cada conta. Para cada ÁREA funcional define-se um NÍVEL de acesso. Cada
// utilizador pode ter permissões personalizadas; quando não tem (null), usa as
// permissões POR DEFEITO do seu perfil (role). O administrador tem sempre
// acesso total e não pode ser restringido.
//
// Níveis (por ordem crescente de permissão):
//   none   -> Sem acesso (área escondida no menu, escritas e leituras bloqueadas)
//   view   -> Apenas ver (só leitura; GET)
//   insert -> Ver e inserir (GET + POST)
//   edit   -> Ver, inserir, editar e apagar (todos os métodos)

export type PermLevel = "none" | "view" | "insert" | "edit";
export type GovernedRole = "editor" | "insercao" | "leitura";
export type AreaKey =
  | "clientes"
  | "fornecedores"
  | "documentos"
  | "bancos"
  | "gestao"
  | "utilizadores";

export type RolePermissions = Record<AreaKey, PermLevel>;

export const AREAS: { key: AreaKey; label: string; descricao: string }[] = [
  { key: "clientes", label: "Clientes", descricao: "Clientes, faturas de clientes e recebimentos" },
  { key: "fornecedores", label: "Fornecedores", descricao: "Fornecedores, faturas de fornecedores e pagamentos" },
  { key: "documentos", label: "Documentos", descricao: "Despesas, impostos, seguros, vencimentos e digitalizações" },
  { key: "bancos", label: "Bancos", descricao: "Contas, caixa, transferências, extratos e reconciliação" },
  { key: "gestao", label: "Gestão", descricao: "Empréstimos, relatórios e Moloni" },
  { key: "utilizadores", label: "Utilizadores", descricao: "Gestão de contas de utilizador" },
];

export const LEVELS: { key: PermLevel; label: string }[] = [
  { key: "none", label: "Sem acesso" },
  { key: "view", label: "Apenas ver" },
  { key: "insert", label: "Ver e inserir" },
  { key: "edit", label: "Ver, inserir, editar e apagar" },
];

const LEVEL_RANK: Record<PermLevel, number> = { none: 0, view: 1, insert: 2, edit: 3 };

// Permissões por defeito de cada perfil (role). Reproduzem EXATAMENTE o
// comportamento base da aplicação, de modo a que nada mude enquanto o
// administrador não personalizar as permissões de um utilizador.
export const DEFAULT_PERMISSIONS: Record<GovernedRole, RolePermissions> = {
  editor: {
    clientes: "edit", fornecedores: "edit", documentos: "edit",
    bancos: "edit", gestao: "edit", utilizadores: "edit",
  },
  insercao: {
    clientes: "insert", fornecedores: "insert", documentos: "insert",
    bancos: "insert", gestao: "insert", utilizadores: "none",
  },
  leitura: {
    clientes: "view", fornecedores: "view", documentos: "view",
    bancos: "view", gestao: "view", utilizadores: "none",
  },
};

function allLevel(level: PermLevel): RolePermissions {
  return { clientes: level, fornecedores: level, documentos: level, bancos: level, gestao: level, utilizadores: level };
}

// Permissões base de um perfil (usadas quando o utilizador não tem permissões
// personalizadas). Admin = acesso total. Perfis não governados (ex.: contas
// exclusivas do ponto) não têm áreas da Gestão.
export function roleBasePerms(role?: string | null): RolePermissions {
  const r = (role ?? "").toLowerCase();
  if (r === "admin") return allLevel("edit");
  if (r === "editor" || r === "insercao" || r === "leitura") {
    return { ...DEFAULT_PERMISSIONS[r as GovernedRole] };
  }
  return allLevel("none");
}

// Normaliza as permissões personalizadas de um utilizador. Se 'raw' for um
// objeto válido, sobrepõe-no à base do perfil (completando áreas em falta);
// caso contrário devolve a base do perfil. O administrador tem sempre acesso
// total (ignora personalização).
export function normalizeUserPerms(raw: any, role?: string | null): RolePermissions {
  const r = (role ?? "").toLowerCase();
  const base = roleBasePerms(role);
  if (r === "admin") return base;
  if (raw && typeof raw === "object") {
    for (const { key: area } of AREAS) {
      const v = raw[area];
      if (v === "none" || v === "view" || v === "insert" || v === "edit") {
        base[area] = v;
      }
    }
  }
  return base;
}

// Limpa um objeto de permissões vindo do cliente, mantendo apenas áreas e
// níveis válidos. Devolve string JSON (para gravar) ou null (repor as
// predefinições do perfil).
export function sanitizePermissions(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const valid: PermLevel[] = ["none", "view", "insert", "edit"];
  const out: Record<string, PermLevel> = {};
  for (const { key } of AREAS) {
    const v = raw[key];
    if (valid.includes(v)) out[key] = v;
  }
  if (Object.keys(out).length === 0) return null;
  return JSON.stringify(out);
}

// Nível exigido por um método HTTP.
export function requiredLevelForMethod(method: string): PermLevel {
  const m = (method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "view";
  if (m === "POST") return "insert";
  return "edit"; // PUT / PATCH / DELETE
}

export function levelAllows(level: PermLevel, required: PermLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

// Mapeia um caminho (página ou API) para as ÁREAS que o governam.
// Devolve [] quando o caminho não é governado (acesso livre a utilizadores
// autenticados — ex.: dashboard, perfil, configurações, ponto).
export function areasForPath(pathname: string): AreaKey[] {
  const p = pathname.replace(/^\/api/, ""); // trata páginas e APIs igualmente
  const starts = (prefix: string) => p === prefix || p.startsWith(prefix + "/") || p.startsWith(prefix + "?");

  // Partilhados por clientes e fornecedores
  if (starts("/faturas") || starts("/faturas-fixas-ignorar") || starts("/faturas-fixas-ok")) return ["clientes", "fornecedores"];

  if (starts("/clientes") || starts("/painel-clientes") || starts("/recebimentos")) return ["clientes"];
  if (starts("/fornecedores") || starts("/painel-fornecedores") || starts("/pagamentos") || starts("/efatura")) return ["fornecedores"];
  if (starts("/despesas") || starts("/impostos") || starts("/seguros") || starts("/vencimentos") || starts("/digitalizacoes") || starts("/ocr") || starts("/upload")) return ["documentos"];
  if (starts("/contas") || starts("/caixa") || starts("/transferencias") || starts("/importar-extrato") || starts("/movimentos-bancarios") || starts("/movimentos") || starts("/reconciliacao") || starts("/balancete")) return ["bancos"];
  // /api/ifthenpay/callback é público (chamado pela IfThenPay) e não passa por aqui.
  if (starts("/emprestimos") || starts("/relatorios") || starts("/moloni")) return ["gestao"];
  if (starts("/utilizadores") || starts("/users")) return ["utilizadores"];

  return [];
}

// Verifica se um utilizador, dadas as suas permissões, pode aceder a um caminho
// com um determinado método. Permite quando QUALQUER área que governe o caminho
// conceda o nível exigido (caminhos partilhados como /faturas).
export function isPathAllowed(perms: RolePermissions, pathname: string, method: string): boolean {
  const areas = areasForPath(pathname);
  if (areas.length === 0) return true; // não governado
  const required = requiredLevelForMethod(method);
  return areas.some((a) => levelAllows(perms[a] ?? "none", required));
}
