export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, forbiddenResponse, isAdmin, podeMexer } from '@/lib/conexus/session-helper'
import { sendTelegramMessage } from '@/lib/conexus/telegram'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    // Estado anterior (para detetar mudança para 'tratado') e dono do assunto
    const previous = await prisma.conexusSubject.findUnique({ where: { id }, select: { status: true, collaboratorId: true } })
    if (!previous) return NextResponse.json({ error: 'Assunto não encontrado' }, { status: 404 })
    if (!podeMexer(session, previous)) return forbiddenResponse()
    const body = await request.json()
    const updateData: any = {}
    if (body?.title !== undefined) updateData.title = body.title
    if (body?.description !== undefined) updateData.description = body.description
    if (body?.client !== undefined) updateData.client = body.client
    if (body?.contactType !== undefined) updateData.contactType = body.contactType
    if (body?.workType !== undefined) updateData.workType = body.workType
    if (body?.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null
    if (body?.priority !== undefined) updateData.priority = body.priority
    if (body?.category !== undefined) updateData.category = body.category
    if (body?.status !== undefined) updateData.status = body.status
    if (body?.reminderDate !== undefined) {
      updateData.reminderDate = body.reminderDate ? new Date(body.reminderDate) : null
      updateData.reminderStatus = body.reminderDate ? 'agendado' : 'nao_definido'
      updateData.reminderSent = false
    }
    if (body?.reminderStatus !== undefined) updateData.reminderStatus = body.reminderStatus
    if (body?.collaboratorId !== undefined && isAdmin(session)) updateData.collaboratorId = body.collaboratorId || null
    if (body?.scope !== undefined) updateData.scope = body.scope
    if (body?.urgent !== undefined) updateData.urgent = body.urgent
    if (body?.important !== undefined) updateData.important = body.important
    if (body?.passedReason !== undefined) updateData.passedReason = body.passedReason
    if (body?.date !== undefined) updateData.date = new Date(body.date)
    if (body?.reminderSent !== undefined) updateData.reminderSent = body.reminderSent


    const subject = await prisma.conexusSubject.update({
      where: { id },
      data: updateData,
      include: { collaborator: true },
    })

    // Notificação Telegram quando tarefa é marcada como concluída
    if (updateData.status === 'tratado' && previous?.status !== 'tratado') {
      const agora = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      const msg = `✅ *Tarefa Concluída*\n\n📝 ${subject?.title ?? 'Sem título'}\n👤 ${subject?.collaborator?.name ?? 'Não atribuído'}\n🕐 ${agora}`
      sendTelegramMessage(msg).catch(() => {}) // fire-and-forget
    }

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
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('PATCH /api/subjects/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar assunto' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const existing = await prisma.conexusSubject.findUnique({ where: { id }, select: { collaboratorId: true } })
    if (!existing) return NextResponse.json({ error: 'Assunto não encontrado' }, { status: 404 })
    if (!podeMexer(session, existing)) return forbiddenResponse()
    await prisma.conexusSubject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/subjects/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao eliminar assunto' }, { status: 500 })
  }
}
