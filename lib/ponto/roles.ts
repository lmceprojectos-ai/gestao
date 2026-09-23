// Normalização de permissões entre a Gestão (role 'admin'/'editor') e o
// módulo Gestão de Ponto (ADMIN/COLABORADOR/QR).

// Administrador NATIVO do módulo de ponto (identidade ADMIN dedicada ao ponto).
// NOTA: os perfis de Gestão 'editor'/'insercao' já NÃO são administradores do ponto.
export function isPontoAdmin(role?: string | null): boolean {
  return (role ?? "").toUpperCase() === "ADMIN";
}

// Indica se um utilizador PODE aceder à área de administração do módulo de ponto.
// Apenas: (a) administrador da Gestão ('admin'); ou (b) conta com perfil de ponto
// dedicado ADMIN (conta legada exclusiva do ponto). Editor/Inserção/Leitura NÃO
// têm acesso à administração do ponto — vêem sempre a vista de colaborador.
export function canPontoAdmin(
  gestaoRole?: string | null,
  pontoRoleValue?: string | null
): boolean {
  if ((gestaoRole ?? "").toLowerCase() === "admin") return true;
  if ((pontoRoleValue ?? "").toUpperCase() === "ADMIN") return true;
  return false;
}

export function isPontoQR(role?: string | null): boolean {
  return (role ?? "").toUpperCase() === "QR";
}

export function pontoRole(role?: string | null): "ADMIN" | "QR" | "COLABORADOR" {
  if (isPontoQR(role)) return "QR";
  if (isPontoAdmin(role)) return "ADMIN";
  return "COLABORADOR";
}

// Indica se o perfil tem acesso à área de Gestão Financeira (perfis da gestão),
// por oposição aos perfis exclusivos do módulo de ponto (COLABORADOR/QR).
export function hasGestaoAccess(role?: string | null): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "admin" || r === "editor" || r === "leitura" || r === "insercao";
}

// Perfis exclusivos do módulo de ponto: só devem aceder ao /ponto.
export function isPontoOnly(role?: string | null): boolean {
  const r = (role ?? "").toUpperCase();
  return r === "COLABORADOR" || r === "QR";
}

// Perfil EFETIVO no módulo de ponto. Dá prioridade ao pontoRole dedicado
// (identidade original do ponto) e, se não existir, deriva do perfil de Gestão.
// Garante que um colaborador que também é admin/editor da Gestão continua a ser
// tratado como COLABORADOR dentro do módulo de ponto.
export function effectivePontoRole(
  pontoRoleValue?: string | null,
  gestaoRole?: string | null
): "ADMIN" | "QR" | "COLABORADOR" {
  if (pontoRoleValue) {
    const r = pontoRoleValue.toUpperCase();
    if (r === "QR") return "QR";
    if (r === "ADMIN") return "ADMIN";
    if (r === "COLABORADOR") return "COLABORADOR";
  }
  return pontoRole(gestaoRole);
}
