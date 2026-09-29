export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// O registo público está desativado: criava contas de administrador para
// qualquer pessoa. As contas criam-se em Gestão → Utilizadores, ou pelos
// parceiros através do link de convite (/convite/<parceiro>).
export async function POST() {
  return NextResponse.json({ error: 'O registo de contas está desativado. Peça acesso a um administrador.' }, { status: 403 });
}
