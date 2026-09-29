export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

export async function POST() {
  // Só administradores (na Gestão estas rotas não podem ficar abertas).
  if (!isAdmin(await getAuthSession())) return unauthorizedResponse()
  try {
    const settings = await prisma.conexusSettings.findUnique({ where: { id: 'default' } })
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return NextResponse.json({ error: 'Telegram não configurado' }, { status: 400 })
    }

    const now = new Date()

    const subjects = await prisma.conexusSubject.findMany({
      where: {
        status: 'pendente',
        reminderSent: false,
        reminderDate: {
          not: null,
          lte: now,
        },
      },
      include: { collaborator: true },
    })

    const results: any[] = []
    for (const subject of (subjects ?? [])) {
      const deadlineStr = subject?.deadline ? new Date(subject.deadline).toLocaleDateString('pt-PT', { timeZone: 'UTC' }) : 'Não definido'
      const reminderDateStr = subject?.reminderDate ? new Date(subject.reminderDate).toLocaleDateString('pt-PT', { timeZone: 'UTC' }) : ''
      const reminderTimeStr = subject?.reminderDate ? new Date(subject.reminderDate).toLocaleTimeString('pt-PT', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) : ''
      const message = `📌 *Lembrete*\n\n🏢 Cliente: *${subject?.client || 'N/A'}*\n📝 Assunto: ${subject?.title ?? 'Sem título'}\n📅 Prazo: ${deadlineStr}\n⏰ Lembrete: ${reminderDateStr} às ${reminderTimeStr}\n👥 Colaborador: ${subject?.collaborator?.name ?? 'Não atribuído'}`
      
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: settings.telegramChatId,
              text: message,
              parse_mode: 'Markdown',
            }),
          }
        )
        const result = await response.json()
        const success = result?.ok === true

        await prisma.conexusReminderLog.create({
          data: {
            subjectId: subject.id,
            success,
            error: success ? null : (result?.description ?? 'Erro desconhecido'),
          },
        })
        await prisma.conexusSubject.update({
          where: { id: subject.id },
          data: {
            reminderSent: success,
            reminderStatus: success ? 'enviado' : 'falhado',
          },
        })
        results.push({ id: subject.id, success })
      } catch (err: any) {
        await prisma.conexusReminderLog.create({
          data: {
            subjectId: subject.id,
            success: false,
            error: err?.message ?? 'Erro de rede',
          },
        })
        results.push({ id: subject.id, success: false })
      }
    }

    return NextResponse.json({ sent: results?.length ?? 0, results })
  } catch (error: any) {
    console.error('POST /api/telegram/reminders error:', error)
    return NextResponse.json({ error: 'Erro ao processar lembretes' }, { status: 500 })
  }
}
