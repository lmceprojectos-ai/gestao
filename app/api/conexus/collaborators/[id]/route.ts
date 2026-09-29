export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const body = await request.json()
    const updateData: any = {}
    if (body?.name !== undefined) updateData.name = body.name
    if (body?.role !== undefined) updateData.role = body.role
    if (body?.color !== undefined) updateData.color = body.color
    if (body?.active !== undefined) updateData.active = body.active

    const collaborator = await prisma.conexusCollaborator.update({
      where: { id },
      data: updateData,
    })
    const serialized = {
      ...collaborator,
      createdAt: collaborator?.createdAt?.toISOString?.() ?? '',
      updatedAt: collaborator?.updatedAt?.toISOString?.() ?? '',
    }
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('PATCH /api/collaborators/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar colaborador' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    await prisma.conexusCollaborator.update({
      where: { id },
      data: { active: false },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/collaborators/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao remover colaborador' }, { status: 500 })
  }
}
