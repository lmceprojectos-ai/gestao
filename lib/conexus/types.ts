export const CONTACT_TYPES = [
  { value: 'interno', label: 'Interno', icon: '🏢' },
  { value: 'pessoal', label: 'Pessoal', icon: '👤' },
  { value: 'cliente', label: 'Cliente', icon: '🤝' },
  { value: 'fornecedor', label: 'Fornecedor', icon: '🏭' },
] as const

export interface CategoryType {
  id: string
  value: string
  label: string
  icon: string
  color: string
  sortOrder: number
  active: boolean
  visibleOnDashboard: boolean
}

export interface ReminderStatusType {
  id: string
  value: string
  label: string
  icon: string
  color: string
  sortOrder: number
  active: boolean
}

export const CATEGORIES = [
  { value: 'orcamentos', label: 'Orçamentos', icon: '📋', color: 'bg-blue-500' },
  { value: 'producao', label: 'Trabalhos em Produção', icon: '🔧', color: 'bg-purple-500' },
  { value: 'faturar', label: 'Clientes a Faturar', icon: '💰', color: 'bg-emerald-500' },
  { value: 'fornecedores', label: 'Fornecedores a Pagar', icon: '🏭', color: 'bg-red-500' },
  { value: 'geral', label: 'Geral', icon: '📌', color: 'bg-slate-500' },
  { value: 'tarefas_diarias', label: 'Tarefas Diárias', icon: '📋', color: 'bg-teal-500' },
] as const

export const REMINDER_STATUSES = [
  { value: 'nao_definido', label: 'Não definido', icon: '⚪', color: 'text-slate-400' },
  { value: 'agendado', label: 'Agendado', icon: '🕐', color: 'text-blue-500' },
  { value: 'enviado', label: 'Enviado', icon: '✅', color: 'text-emerald-500' },
  { value: 'falhado', label: 'Falhado', icon: '❌', color: 'text-red-500' },
] as const

export interface SubjectType {
  id: string
  title: string
  description: string
  client: string
  contactType: string
  workType: string
  deadline: string | null
  priority: string
  category: string
  status: string
  date: string
  reminderDate: string | null
  reminderStatus: string
  reminderSent: boolean
  scope: string
  urgent: boolean
  important: boolean
  passedReason: string | null
  passedFromId: string | null
  collaboratorId: string | null
  collaborator: CollaboratorType | null
  createdAt: string
  updatedAt: string
}

export interface CollaboratorType {
  id: string
  name: string
  email: string | null
  role: string
  color: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface UserType {
  id: string
  email: string
  name: string
  role: string
  collaboratorId: string | null
}

export interface SettingsType {
  id: string
  telegramBotToken: string
  telegramChatId: string
}

export interface DaySummary {
  total: number
  treated: number
  pending: number
  passed: number
}
