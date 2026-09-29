export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, getCollaboratorFilter, isAdmin } from '@/lib/conexus/session-helper'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request?.url ?? '')
    const dateFrom = searchParams?.get('dateFrom')
    const dateTo = searchParams?.get('dateTo')
    const collaboratorId = searchParams?.get('collaboratorId')

    const collabFilter = getCollaboratorFilter(session)
    const where: any = { status: 'passado', ...collabFilter }
    if (dateFrom && dateTo) {
      where.date = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      }
    } else if (dateFrom) {
      where.date = { gte: new Date(dateFrom) }
    } else if (dateTo) {
      where.date = { lte: new Date(dateTo) }
    }
    if (collaboratorId && isAdmin(session)) {
      where.collaboratorId = collaboratorId
    }

    const subjects = await prisma.conexusSubject.findMany({
      where,
      include: { collaborator: true },
      orderBy: { date: 'desc' },
    })
    const serialized = (subjects ?? []).map((s: any) => ({
      ...s,
      date: s?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      deadline: s?.deadline?.toISOString?.() ?? null,
      createdAt: s?.createdAt?.toISOString?.() ?? '',
      updatedAt: s?.updatedAt?.toISOString?.() ?? '',
      collaborator: s?.collaborator ? {
        ...s.collaborator,
        createdAt: s.collaborator?.createdAt?.toISOString?.() ?? '',
        updatedAt: s.collaborator?.updatedAt?.toISOString?.() ?? '',
      } : null,
    }))
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('GET /api/history error:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}
