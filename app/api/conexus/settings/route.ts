export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    let settings = await prisma.conexusSettings.findUnique({ where: { id: 'default' } })
    if (!settings) {
      settings = await prisma.conexusSettings.create({
        data: { id: 'default' },
      })
    }
    return NextResponse.json({
      id: settings?.id ?? 'default',
      telegramBotToken: settings?.telegramBotToken ?? '',
      telegramChatId: settings?.telegramChatId ?? '',
    })
  } catch (error: any) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    const body = await request.json()
    const { telegramBotToken, telegramChatId } = body ?? {}
    const settings = await prisma.conexusSettings.upsert({
      where: { id: 'default' },
      update: {
        telegramBotToken: telegramBotToken ?? '',
        telegramChatId: telegramChatId ?? '',
      },
      create: {
        id: 'default',
        telegramBotToken: telegramBotToken ?? '',
        telegramChatId: telegramChatId ?? '',
      },
    })
    return NextResponse.json({
      id: settings?.id ?? 'default',
      telegramBotToken: settings?.telegramBotToken ?? '',
      telegramChatId: settings?.telegramChatId ?? '',
    })
  } catch (error: any) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Erro ao guardar configurações' }, { status: 500 })
  }
}
