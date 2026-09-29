export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, getCollaboratorFilter } from '@/lib/conexus/session-helper'
import { autoPassOverdue } from '@/lib/conexus/auto-pass'


// Id fixo por tarefa diária e dia: pedidos em paralelo não criam duplicados.
const idDiaria = (dailyTaskId: string, date: Date) => `dt_${dailyTaskId}_${date.toISOString().slice(0, 10)}`

// Auto-gera assuntos a partir dos templates DailyTask para uma data
async function ensureDailyTasks(date: Date) {
  const dailyTasks = await prisma.conexusDailyTask.findMany({
    where: { active: true },
    include: { collaborator: true },
  })
  if (dailyTasks.length === 0) return

  // Verificar quais já existem para esta data
  const existing = await prisma.conexusSubject.findMany({
    where: {
      date,
      category: 'tarefas_diarias',
    },
    select: { title: true, collaboratorId: true },
  })

  const existingKeys = new Set(existing.map(e => `${e.title}||${e.collaboratorId || ''}`))

  const toCreate = dailyTasks.filter(dt => {
    const key = `${dt.title}||${dt.collaboratorId}`
    return !existingKeys.has(key)
  })

  if (toCreate.length > 0) {
    await prisma.conexusSubject.createMany({
      skipDuplicates: true,
      data: toCreate.map(dt => ({
        id: idDiaria(dt.id, date),
        title: dt.title,
        description: dt.description || '',
        category: 'tarefas_diarias',
        date,
        priority: 'media',
        status: 'pendente',
        collaboratorId: dt.collaboratorId,
        contactType: 'interno',
        scope: 'profissional',
      })),
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request?.url ?? '')
    const dateStr = searchParams?.get('date')
    const startDate = searchParams?.get('startDate')
    const endDate = searchParams?.get('endDate')

    let whereClause: any = { ...getCollaboratorFilter(session) }
    if (startDate && endDate) {
      whereClause.date = { gte: new Date(startDate), lte: new Date(endDate) }
    } else if (dateStr) {
      // Data de hoje no fuso de Lisboa (formato YYYY-MM-DD)
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
      // Só corre a passagem automática quando se está a ver o dia de hoje
      if (dateStr === todayStr) {
        try {
          await autoPassOverdue(new Date(dateStr))
        } catch (e) {
          console.error('Erro ao passar assuntos automaticamente:', e)
        }
      }
      // Auto-gerar tarefas diárias para esta data se ainda não existem
      try {
        await ensureDailyTasks(new Date(dateStr))
      } catch (e) {
        console.error('Erro ao gerar tarefas diárias:', e)
      }
      // O assunto aparece no seu dia (date) OU no dia do prazo de entrega (deadline)
      const dayStart = new Date(dateStr)
      const dayEnd = new Date(dayStart)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      whereClause.OR = [
        { date: dayStart },
        { deadline: { gte: dayStart, lt: dayEnd }, status: { not: 'passado' } },
      ]
    } else {
      return NextResponse.json({ error: 'Parâmetro date ou startDate/endDate obrigatório' }, { status: 400 })
    }
    const subjects = await prisma.conexusSubject.findMany({
      where: whereClause,
      include: { collaborator: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })
    const serialized = (subjects ?? []).map((s: any) => ({
      ...s,
      date: s?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      deadline: s?.deadline?.toISOString?.() ?? null,
      reminderDate: s?.reminderDate?.toISOString?.() ?? null,
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
    console.error('GET /api/subjects error:', error)
    return NextResponse.json({ error: 'Erro ao buscar assuntos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const body = await request.json()
    const { title, description, client, contactType, workType, deadline, priority, category, date, reminderDate, collaboratorId, scope, urgent, important } = body ?? {}
    if (!title || !date) {
      return NextResponse.json({ error: 'Título e data obrigatórios' }, { status: 400 })
    }
    // Colaboradores (não-admin) só criam assuntos atribuídos a si próprios,
    // para que apareçam na sua visualização (que é filtrada pelo seu ID).
    const isAdminUser = session?.user?.role === 'admin'
    const finalCollaboratorId = isAdminUser
      ? (collaboratorId || null)
      : ((session?.user as any)?.collaboratorId || null)
    const subject = await prisma.conexusSubject.create({
      data: {
        title: title ?? '',
        description: description ?? '',
        client: client ?? '',
        contactType: contactType ?? 'interno',
        workType: workType ?? '',
        deadline: deadline ? new Date(deadline) : null,
        priority: priority ?? 'media',
        category: category ?? 'geral',
        date: new Date(date),
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        reminderStatus: reminderDate ? 'agendado' : 'nao_definido',
        scope: scope || 'profissional',
        urgent: urgent === true,
        important: important === true,
        collaboratorId: finalCollaboratorId,
      },
      include: { collaborator: true },
    })
    const serialized = {
      ...subject,
      date: subject?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      deadline: subject?.deadline?.toISOString?.() ?? null,
      reminderDate: subject?.reminderDate?.toISOString?.() ?? null,
      createdAt: subject?.createdAt?.toISOString?.() ?? '',
      updatedAt: subject?.updatedAt?.toISOString?.() ?? '',
      collaborator: subject?.collaborator ? {
        ...subject.collaborator,
        createdAt: subject.collaborator?.createdAt?.toISOString?.() ?? '',
        updatedAt: subject.collaborator?.updatedAt?.toISOString?.() ?? '',
      } : null,
    }
    return NextResponse.json(serialized, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/subjects error:', error)
    return NextResponse.json({ error: 'Erro ao criar assunto' }, { status: 500 })
  }
}
