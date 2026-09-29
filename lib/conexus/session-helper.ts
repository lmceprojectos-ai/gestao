// Sessão no Conexus: usa a sessão da Gestão. Só os administradores têm acesso,
// e veem tudo (na app original os colaboradores só viam as suas tarefas).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'

export async function getAuthSession() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') return null
  return session as any
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}

export function isAdmin(session: any) {
  return session?.user?.role === 'admin'
}

export function getCollaboratorFilter(session: any) {
  if (isAdmin(session)) return {}
  return { collaboratorId: 'none' }
}
