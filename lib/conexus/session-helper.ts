// Sessão no Conexus: usa a sessão da Gestão. Os utilizadores cuja conta está
// ligada a um colaborador do Conexus (pelo email da ficha do colaborador) só veem
// e mexem nas suas tarefas — mesmo que sejam administradores da Gestão. Os
// administradores da Gestão sem colaborador ligado veem e editam tudo.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'

export async function getAuthSession() {
  const session = await getServerSession(authOptions)
  const u = session?.user as any
  if (u?.role !== 'admin' && !u?.collaboratorId) return null
  return session as any
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
}

export function isAdmin(session: any) {
  return session?.user?.role === 'admin' && !session?.user?.collaboratorId
}

export function getCollaboratorFilter(session: any) {
  if (isAdmin(session)) return {}
  return { collaboratorId: session?.user?.collaboratorId || 'none' }
}

// Um colaborador só pode mexer nos assuntos atribuídos a si.
export function podeMexer(session: any, subject: { collaboratorId: string | null } | null) {
  if (!subject) return false
  return isAdmin(session) || (!!subject.collaboratorId && subject.collaboratorId === session?.user?.collaboratorId)
}
