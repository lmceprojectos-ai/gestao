export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

// PATCH - update daily task
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()
    if (!isAdmin(session)) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const body = await request.json()
    const updateData: any = {}
    if (body?.title !== undefined) updateData.title = body.title
    if (body?.description !== undefined) updateData.description = body.description
    if (body?.collaboratorId !== undefined) updateData.collaboratorId = body.collaboratorId
    if (body?.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body?.active !== undefined) updateData.active = body.active

    const task = await prisma.conexusDailyTask.update({
      where: { id },
      data: updateData,
      include: { collaborator: true },
    })

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('PATCH /api/daily-tasks/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

// DELETE - remove daily task
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()
    if (!isAdmin(session)) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.conexusDailyTask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/daily-tasks/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao eliminar' }, { status: 500 })
  }
}
