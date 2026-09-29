export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'
import { autoPassPersonalNotes } from '@/lib/conexus/auto-pass'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request?.url ?? '')
    const dateStr = searchParams?.get('date')
    const startDate = searchParams?.get('startDate')
    const endDate = searchParams?.get('endDate')

    // Se estamos a carregar o dia de hoje, passar automaticamente as notas por concluir dos dias anteriores
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
    if (dateStr && dateStr === todayStr) {
      try {
        await autoPassPersonalNotes(new Date(todayStr), session?.user?.id)
      } catch (e) {
        console.error('Erro ao passar notas pessoais:', e)
      }
    }

    const userId = session?.user?.id

    let whereClause: any = { userId }
    if (startDate && endDate) {
      whereClause = { userId, date: { gte: new Date(startDate), lte: new Date(endDate) } }
    } else if (dateStr) {
      whereClause = { userId, date: new Date(dateStr) }
    } else {
      return NextResponse.json({ error: 'Parâmetro date ou startDate/endDate obrigatório' }, { status: 400 })
    }

    const notes = await prisma.conexusPersonalNote.findMany({
      where: whereClause,
      orderBy: [{ done: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
    })
    const serialized = (notes ?? []).map((n: any) => ({
      ...n,
      date: n?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      createdAt: n?.createdAt?.toISOString?.() ?? '',
      updatedAt: n?.updatedAt?.toISOString?.() ?? '',
    }))
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('GET /api/personal-notes error:', error)
    return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const body = await request.json()
    const { title, content, date, time, priority, source } = body ?? {}
    if (!title || !date) {
      return NextResponse.json({ error: 'Título e data obrigatórios' }, { status: 400 })
    }
    const note = await prisma.conexusPersonalNote.create({
      data: {
        userId: session?.user?.id,
        title: title ?? '',
        content: content ?? '',
        date: new Date(date),
        time: time || null,
        priority: priority ?? 'media',
        source: source ?? 'text',
      },
    })
    const serialized = {
      ...note,
      date: note?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      createdAt: note?.createdAt?.toISOString?.() ?? '',
      updatedAt: note?.updatedAt?.toISOString?.() ?? '',
    }
    return NextResponse.json(serialized, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/personal-notes error:', error)
    return NextResponse.json({ error: 'Erro ao criar nota' }, { status: 500 })
  }
}
