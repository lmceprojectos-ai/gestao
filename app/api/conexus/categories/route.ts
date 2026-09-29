export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse, isAdmin } from '@/lib/conexus/session-helper'

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session) return unauthorizedResponse()

    const categories = await prisma.conexusCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(categories ?? [])
  } catch (error: any) {
    console.error('GET /api/categories error:', error)
    return NextResponse.json({ error: 'Erro ao buscar categorias' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session || !isAdmin(session)) return unauthorizedResponse()

    const body = await request.json()
    const { label, icon, color } = body ?? {}
    if (!label) {
      return NextResponse.json({ error: 'Nome obrigat\u00f3rio' }, { status: 400 })
    }
    const value = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const maxSort = await prisma.conexusCategory.aggregate({ _max: { sortOrder: true } })
    const category = await prisma.conexusCategory.create({
      data: {
        value,
        label,
        icon: icon || '\ud83d\udccc',
        color: color || 'bg-slate-500',
        sortOrder: (maxSort?._max?.sortOrder ?? 0) + 1,
      },
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'J\u00e1 existe uma categoria com esse nome' }, { status: 409 })
    }
    console.error('POST /api/categories error:', error)
    return NextResponse.json({ error: 'Erro ao criar categoria' }, { status: 500 })
  }
}
