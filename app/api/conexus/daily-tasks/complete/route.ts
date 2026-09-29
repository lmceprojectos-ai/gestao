export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

// POST - toggle daily task completion for a date
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const body = await request.json()
    const { dailyTaskId, date, note } = body ?? {}

    if (!dailyTaskId || !date) {
      return NextResponse.json({ error: 'dailyTaskId e date obrigatórios' }, { status: 400 })
    }

    const dateObj = new Date(date)

    // Check if already completed — if so, remove it (toggle)
    const existing = await prisma.conexusDailyTaskCompletion.findUnique({
      where: { dailyTaskId_date: { dailyTaskId, date: dateObj } }
    })

    if (existing) {
      await prisma.conexusDailyTaskCompletion.delete({ where: { id: existing.id } })
      return NextResponse.json({ completed: false })
    }

    // Create completion
    const completion = await prisma.conexusDailyTaskCompletion.create({
      data: {
        dailyTaskId,
        date: dateObj,
        note: note ?? '',
      }
    })

    return NextResponse.json({
      completed: true,
      completion: {
        ...completion,
        date: completion.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
        completedAt: completion.completedAt?.toISOString?.() ?? '',
      }
    })
  } catch (error: any) {
    console.error('POST /api/daily-tasks/complete error:', error)
    return NextResponse.json({ error: 'Erro ao completar tarefa' }, { status: 500 })
  }
}
