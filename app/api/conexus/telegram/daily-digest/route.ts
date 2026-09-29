export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/conexus/telegram'
import { autoPassOverdue, autoPassPersonalNotes } from '@/lib/conexus/auto-pass'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

// Garante que as tarefas diárias existem para a data indicada
async function ensureDailyTasks(date: Date) {
  const dailyTasks = await prisma.conexusDailyTask.findMany({ where: { active: true } })
  if (dailyTasks.length === 0) return
  const existing = await prisma.conexusSubject.findMany({
    where: { date, category: 'tarefas_diarias' },
    select: { title: true, collaboratorId: true },
  })
  const existingKeys = new Set(existing.map(e => `${e.title}||${e.collaboratorId || ''}`))
  const toCreate = dailyTasks.filter(dt => !existingKeys.has(`${dt.title}||${dt.collaboratorId}`))
  if (toCreate.length > 0) {
    await prisma.conexusSubject.createMany({
      data: toCreate.map(dt => ({
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

export async function POST() {
  // Só administradores (na Gestão estas rotas não podem ficar abertas).
  if (!(await getAuthSession())) return unauthorizedResponse()
  try {
    const settings = await prisma.conexusSettings.findUnique({ where: { id: 'default' } })
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return NextResponse.json({ error: 'Telegram não configurado' }, { status: 400 })
    }

    // Data de hoje no fuso de Lisboa
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
    const today = new Date(todayStr)

    // Passar automaticamente para hoje as tarefas em atraso (regra global para todos)
    try {
      const passed = await autoPassOverdue(today)
      if (passed > 0) console.log(`Resumo diário: ${passed} tarefa(s) em atraso passada(s) para hoje.`)
      const passedNotes = await autoPassPersonalNotes(today)
      if (passedNotes > 0) console.log(`Resumo diário: ${passedNotes} nota(s) pessoal(is) passada(s) para hoje.`)
    } catch (e) {
      console.error('Erro ao passar tarefas em atraso no resumo:', e)
    }

    // Garantir tarefas diárias de hoje
    try {
      await ensureDailyTasks(today)
    } catch (e) {
      console.error('Erro ao gerar tarefas diárias no resumo:', e)
    }

    // Mapa de categorias (valor -> label + ícone)
    const categories = await prisma.conexusCategory.findMany()
    const catMap = new Map(categories.map((c: any) => [c.value, { label: c.label, icon: c.icon }]))

    // Todas as tarefas pendentes de hoje
    const subjects = await prisma.conexusSubject.findMany({
      where: { date: today, status: 'pendente' },
      include: { collaborator: true },
      orderBy: [{ category: 'asc' }, { priority: 'asc' }],
    })

    // Agrupar por colaborador
    const groups = new Map<string, { name: string; items: any[] }>()
    for (const s of subjects) {
      const key = s.collaboratorId || 'sem_atribuicao'
      const name = s.collaborator?.name || 'Sem atribuição'
      if (!groups.has(key)) groups.set(key, { name, items: [] })
      groups.get(key)!.items.push(s)
    }

    const dataFormatada = today.toLocaleDateString('pt-PT', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })

    if (groups.size === 0) {
      await sendTelegramMessage(`📅 *Resumo Diário — ${dataFormatada}*\n\nNão há tarefas pendentes para hoje. 🎉`)
      return NextResponse.json({ sent: true, groups: 0 })
    }

    // Construir mensagem
    let message = `📅 *Resumo Diário — ${dataFormatada}*\n`
    for (const { name, items } of Array.from(groups.values())) {
      message += `\n👤 *${name}* (${items.length} tarefa${items.length === 1 ? '' : 's'})\n`
      for (const s of items) {
        const cat = catMap.get(s.category)
        const icon = cat?.icon || '•'
        const client = s.client ? ` – ${s.client}` : ''
        message += `${icon} ${s.title}${client}\n`
      }
    }

    const ok = await sendTelegramMessage(message)
    return NextResponse.json({ sent: ok, groups: groups.size })
  } catch (error: any) {
    console.error('POST /api/telegram/daily-digest error:', error)
    return NextResponse.json({ error: 'Erro ao enviar resumo diário' }, { status: 500 })
  }
}
