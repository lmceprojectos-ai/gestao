import { prisma } from '@/lib/db'

/**
 * Passa automaticamente para `today` todos os assuntos pendentes de dias anteriores
 * (exceto tarefas diárias, que se regeneram automaticamente).
 * O original é marcado como `passado` e é criada uma cópia para hoje.
 * A regra é GLOBAL: aplica-se a TODOS os colaboradores, independentemente de quem a aciona.
 */
export async function autoPassOverdue(today: Date) {
  const overdue = await prisma.conexusSubject.findMany({
    where: {
      status: 'pendente',
      date: { lt: today },
      category: { not: 'tarefas_diarias' },
    },
  })
  if (overdue.length === 0) return 0

  let count = 0
  for (const original of overdue) {
    // Marcar o original como passado
    await prisma.conexusSubject.update({
      where: { id: original.id },
      data: { status: 'passado', passedReason: 'Adiado automaticamente' },
    })
    // Criar cópia para hoje
    await prisma.conexusSubject.create({
      data: {
        title: original.title,
        description: original.description,
        client: original.client,
        contactType: original.contactType,
        workType: original.workType,
        deadline: original.deadline,
        priority: original.priority,
        category: original.category,
        scope: original.scope,
        date: today,
        reminderDate: original.reminderDate,
        reminderStatus: original.reminderDate ? 'agendado' : 'nao_definido',
        collaboratorId: original.collaboratorId,
        urgent: original.urgent,
        important: original.important,
        passedFromId: original.id,
      },
    })
    count++
  }
  return count
}

/**
 * Passa automaticamente para `today` todas as notas da agenda pessoal por concluir
 * (done = false) de dias anteriores. A regra é GLOBAL: aplica-se a todos os utilizadores.
 * A nota é simplesmente transportada para o dia atual (a sua data é atualizada),
 * permanecendo visível até ser concluída.
 */
export async function autoPassPersonalNotes(today: Date, userId?: string) {
  const where: any = { done: false, date: { lt: today } }
  if (userId) where.userId = userId
  const result = await prisma.conexusPersonalNote.updateMany({
    where,
    data: { date: today },
  })
  return result.count
}
