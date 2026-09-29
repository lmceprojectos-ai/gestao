export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

// GET - list daily tasks with completions for a given date
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const collaboratorId = searchParams.get('collaboratorId')

    const where: any = { active: true }
    // Collaborators only see their own tasks
    if (!isAdmin(session)) {
      where.collaboratorId = session?.user?.collaboratorId || 'none'
    } else if (collaboratorId) {
      where.collaboratorId = collaboratorId
    }

    const tasks = await prisma.conexusDailyTask.findMany({
      where,
      include: {
        collaborator: true,
        completions: dateStr ? {
          where: { date: new Date(dateStr) }
        } : false,
      },
      orderBy: [{ collaboratorId: 'asc' }, { sortOrder: 'asc' }],
    })

    const serialized = tasks.map((t: any) => ({
      ...t,
      createdAt: t.createdAt?.toISOString?.() ?? '',
      updatedAt: t.updatedAt?.toISOString?.() ?? '',
      collaborator: t.collaborator ? {
        ...t.collaborator,
        createdAt: t.collaborator.createdAt?.toISOString?.() ?? '',
        updatedAt: t.collaborator.updatedAt?.toISOString?.() ?? '',
      } : null,
      completions: (t.completions || []).map((c: any) => ({
        ...c,
        date: c.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
        completedAt: c.completedAt?.toISOString?.() ?? '',
      })),
      completed: (t.completions || []).length > 0,
    }))

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('GET /api/daily-tasks error:', error)
    return NextResponse.json({ error: 'Erro ao buscar tarefas diárias' }, { status: 500 })
  }
}

// POST - create a new daily task (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()
    if (!isAdmin(session)) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })

    const body = await request.json()
    const { title, description, collaboratorId, sortOrder } = body ?? {}

    if (!title || !collaboratorId) {
      return NextResponse.json({ error: 'Título e colaborador obrigatórios' }, { status: 400 })
    }

    const task = await prisma.conexusDailyTask.create({
      data: {
        title,
        description: description ?? '',
        collaboratorId,
        sortOrder: sortOrder ?? 0,
      },
      include: { collaborator: true },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/daily-tasks error:', error)
    return NextResponse.json({ error: 'Erro ao criar tarefa diária' }, { status: 500 })
  }
}
