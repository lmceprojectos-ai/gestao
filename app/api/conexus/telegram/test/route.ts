export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

export async function POST(request: NextRequest) {
  // Só administradores (na Gestão estas rotas não podem ficar abertas).
  if (!(await getAuthSession())) return unauthorizedResponse()
  try {
    const body = await request.json()
    let { botToken, chatId } = body ?? {}
    
    // If not provided directly, get from settings
    if (!botToken || !chatId) {
      const settings = await prisma.conexusSettings.findUnique({ where: { id: 'default' } })
      botToken = botToken || settings?.telegramBotToken
      chatId = chatId || settings?.telegramChatId
    }
    
    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Bot Token e Chat ID são obrigatórios' }, { status: 400 })
    }

    const message = '✅ *Teste de Ligação*\n\nO Conexus está ligado com sucesso ao Telegram!'
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    const result = await response.json()
    if (!result?.ok) {
      return NextResponse.json({ 
        error: `Erro do Telegram: ${result?.description ?? 'Erro desconhecido'}` 
      }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' })
  } catch (error: any) {
    console.error('POST /api/telegram/test error:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem de teste' }, { status: 500 })
  }
}
