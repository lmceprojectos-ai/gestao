export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthSession, unauthorizedResponse } from '@/lib/conexus/session-helper'

// Traz os dados da app CONEXUS (Abacus): colaboradores, categorias, estados de
// lembrete, tarefas diárias, assuntos e notas pessoais. Mantém os ids (para as
// ligações ficarem certas) e não duplica: o que já existir com o mesmo id fica.
// As notas pessoais ficam com o utilizador da Gestão que tiver o mesmo email.
const d = (v: any) => (v ? new Date(v) : null)
const dia = (v: any) => new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`)

export async function POST(request: NextRequest) {
  const session = await getAuthSession()
  if (!session) return unauthorizedResponse()
  const b = await request.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const r: Record<string, number> = {}

  r.colaboradores = (await prisma.conexusCollaborator.createMany({
    skipDuplicates: true,
    data: (b.collabs ?? []).map((c: any) => ({ id: c.id, name: c.name, email: c.email ?? null, role: c.role ?? '', color: c.color ?? '#1e3a5f', active: c.active !== false, createdAt: d(c.createdAt) ?? undefined })),
  })).count
  r.categorias = (await prisma.conexusCategory.createMany({
    skipDuplicates: true,
    data: (b.cats ?? []).map((c: any) => ({ id: c.id, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: c.sortOrder ?? 0, active: c.active !== false, visibleOnDashboard: c.visibleOnDashboard !== false })),
  })).count
  r.estadosLembrete = (await prisma.conexusReminderStatus.createMany({
    skipDuplicates: true,
    data: (b.rems ?? []).map((c: any) => ({ id: c.id, value: c.value, label: c.label, icon: c.icon, color: c.color, sortOrder: c.sortOrder ?? 0, active: c.active !== false })),
  })).count
  r.tarefasDiarias = (await prisma.conexusDailyTask.createMany({
    skipDuplicates: true,
    data: (b.daily ?? []).map((t: any) => ({ id: t.id, title: t.title, description: t.description ?? '', collaboratorId: t.collaboratorId, sortOrder: t.sortOrder ?? 0, active: t.active !== false, createdAt: d(t.createdAt) ?? undefined })),
  })).count

  const assuntos = (b.subjects ?? []).map((s: any) => ({
    id: s.id, title: s.title, description: s.description ?? '', client: s.client ?? '', contactType: s.contactType ?? 'interno',
    workType: s.workType ?? '', deadline: d(s.deadline), priority: s.priority ?? 'media', category: s.category ?? 'geral',
    status: s.status ?? 'pendente', date: dia(s.date), reminderTime: s.reminderTime ?? null, reminderDate: d(s.reminderDate),
    reminderStatus: s.reminderStatus ?? 'nao_definido', reminderSent: !!s.reminderSent, scope: s.scope ?? 'profissional',
    urgent: !!s.urgent, important: !!s.important, passedReason: s.passedReason ?? null, passedFromId: s.passedFromId ?? null,
    collaboratorId: s.collaboratorId ?? null, createdAt: d(s.createdAt) ?? undefined,
  }))
  r.assuntos = 0
  for (let i = 0; i < assuntos.length; i += 200) {
    r.assuntos += (await prisma.conexusSubject.createMany({ skipDuplicates: true, data: assuntos.slice(i, i + 200) })).count
  }

  const emails = [...new Set((b.notes ?? []).map((n: any) => String(n.userEmail ?? '').toLowerCase()).filter(Boolean))] as string[]
  const users = emails.length ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : []
  const idPorEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]))
  r.notasPessoais = (await prisma.conexusPersonalNote.createMany({
    skipDuplicates: true,
    data: (b.notes ?? []).map((n: any) => ({
      id: n.id, userId: idPorEmail.get(String(n.userEmail ?? '').toLowerCase()) ?? session.user.id, title: n.title, content: n.content ?? '',
      date: dia(n.date), time: n.time ?? null, priority: n.priority ?? 'media', done: !!n.done, source: n.source ?? 'text', createdAt: d(n.createdAt) ?? undefined,
    })),
  })).count

  return NextResponse.json(r)
}
