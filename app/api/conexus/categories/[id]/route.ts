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
    if (!id) return NextResponse.json({ error: 'ID obrigat\u00f3rio' }, { status: 400 })
    const body = await request.json()
    const updateData: any = {}
    if (body?.label !== undefined) updateData.label = body.label
    if (body?.icon !== undefined) updateData.icon = body.icon
    if (body?.color !== undefined) updateData.color = body.color
    if (body?.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body?.active !== undefined) updateData.active = body.active
    if (body?.visibleOnDashboard !== undefined) updateData.visibleOnDashboard = body.visibleOnDashboard

    const category = await prisma.conexusCategory.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(category)
  } catch (error: any) {
    console.error('PATCH /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar categoria' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigat\u00f3rio' }, { status: 400 })
    await prisma.conexusCategory.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao remover categoria' }, { status: 500 })
  }
}