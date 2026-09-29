export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const collaborators = await prisma.conexusCollaborator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    const serialized = (collaborators ?? []).map((c: any) => ({
      ...c,
      createdAt: c?.createdAt?.toISOString?.() ?? '',
      updatedAt: c?.updatedAt?.toISOString?.() ?? '',
    }))
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('GET /api/collaborators error:', error)
    return NextResponse.json({ error: 'Erro ao buscar colaboradores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    const body = await request.json()
    const { name, role, color } = body ?? {}
    if (!name) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    }
    const collaborator = await prisma.conexusCollaborator.create({
      data: { name, role: role ?? '', color: color || '#1e3a5f' },
    })
    const serialized = {
      ...collaborator,
      createdAt: collaborator?.createdAt?.toISOString?.() ?? '',
      updatedAt: collaborator?.updatedAt?.toISOString?.() ?? '',
    }
    return NextResponse.json(serialized, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/collaborators error:', error)
    return NextResponse.json({ error: 'Erro ao criar colaborador' }, { status: 500 })
  }
}
