export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const body = await request.json()
    const updateData: any = {}
    if (body?.title !== undefined) updateData.title = body.title
    if (body?.content !== undefined) updateData.content = body.content
    if (body?.time !== undefined) updateData.time = body.time || null
    if (body?.priority !== undefined) updateData.priority = body.priority
    if (body?.done !== undefined) updateData.done = body.done
    if (body?.date !== undefined) updateData.date = new Date(body.date)

    // Garantir que o utilizador só altera as suas próprias notas
    const existing = await prisma.conexusPersonalNote.findUnique({ where: { id }, select: { userId: true } })
    if (!existing || existing.userId !== session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }
    const note = await prisma.conexusPersonalNote.update({
      where: { id },
      data: updateData,
    })
    const serialized = {
      ...note,
      date: note?.date?.toISOString?.()?.split?.('T')?.[0] ?? '',
      createdAt: note?.createdAt?.toISOString?.() ?? '',
      updatedAt: note?.updatedAt?.toISOString?.() ?? '',
    }
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('PATCH /api/personal-notes/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar nota' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const id = params?.id
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    // Garantir que o utilizador só elimina as suas próprias notas
    const existing = await prisma.conexusPersonalNote.findUnique({ where: { id }, select: { userId: true } })
    if (!existing || existing.userId !== session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }
    await prisma.conexusPersonalNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/personal-notes/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao eliminar nota' }, { status: 500 })
  }
}
