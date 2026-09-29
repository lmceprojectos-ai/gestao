export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const body = await request.json()
    const { subjectId, reason } = body ?? {}
    if (!subjectId) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    }
    const finalReason = reason || 'Adiado'
    const original = await prisma.conexusSubject.findUnique({ where: { id: subjectId } })
    if (!original) {
      return NextResponse.json({ error: 'Assunto não encontrado' }, { status: 404 })
    }
    // Mark original as passed
    await prisma.conexusSubject.update({
      where: { id: subjectId },
      data: { status: 'passado', passedReason: finalReason },
    })
    // Create new subject for next day
    const nextDay = new Date(original.date)
    nextDay.setDate(nextDay.getDate() + 1)
    const newSubject = await prisma.conexusSubject.create({
      data: {
        title: original.title,
        description: original.description + (original.description ? '\n' : '') + '[Passado: ' + finalReason + ']',
        client: original.client,
        contactType: original.contactType,
        workType: original.workType,
        deadline: original.deadline,
        priority: original.priority,
        category: original.category,
        date: nextDay,
        reminderDate: original.reminderDate,
        reminderStatus: original.reminderDate ? 'agendado' : 'nao_definido',
        collaboratorId: original.collaboratorId,
        urgent: original.urgent,
        important: original.important,
        passedFromId: original.id,
      },
      include: { collaborator: true },
    })
    const serialized = {
      ...newSubject,
      date: newSubject?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      deadline: newSubject?.deadline?.toISOString?.() ?? null,
      reminderDate: newSubject?.reminderDate?.toISOString?.() ?? null,
      createdAt: newSubject?.createdAt?.toISOString?.() ?? '',
      updatedAt: newSubject?.updatedAt?.toISOString?.() ?? '',
      collaborator: newSubject?.collaborator ? {
        ...newSubject.collaborator,
        createdAt: newSubject.collaborator?.createdAt?.toISOString?.() ?? '',
        updatedAt: newSubject.collaborator?.updatedAt?.toISOString?.() ?? '',
      } : null,
    }
    return NextResponse.json(serialized, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/subjects/pass error:', error)
    return NextResponse.json({ error: 'Erro ao passar assunto' }, { status: 500 })
  }
}
