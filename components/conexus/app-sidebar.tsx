'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Settings, History, CalendarDays, Lock, Menu, X, Grid2X2, LogOut, PanelLeftClose, PanelLeftOpen, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { hasGestaoAccess } from '@/lib/ponto/roles'

const navItems = [
  { href: '/conexus', label: 'Conexus', icon: LayoutDashboard, adminOnly: false },
  { href: '/conexus/calendario', label: 'Calendário', icon: CalendarDays, adminOnly: false },
  { href: '/conexus/agenda-pessoal', label: 'Agenda Pessoal', icon: Lock, adminOnly: false },
  { href: '/conexus/matriz', label: 'Matriz Eisenhower', icon: Grid2X2, adminOnly: false },
  { href: '/conexus/colaboradores', label: 'Colaboradores', icon: Users, adminOnly: true },
  { href: '/conexus/historico', label: 'Histórico', icon: History, adminOnly: true },
  { href: '/conexus/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
]

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession() || {}
  const isAdmin = session?.user?.role === 'admin'
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin)
  const temGestao = hasGestaoAccess((session?.user as any)?.role ?? '')

  return (
    <>
      {/* Mobile hamburger - always show on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-[#1e3a5f] text-white p-2 rounded-lg shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop: floating open button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="hidden md:flex fixed top-4 left-4 z-50 items-center justify-center w-10 h-10 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#2a4f7a] shadow-lg transition-colors"
          aria-label="Abrir menu"
          title="Abrir menu lateral"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        style={{
          transform: collapsed && !mobileOpen ? 'translateX(-100%)' : mobileOpen ? 'translateX(0)' : undefined,
        }}
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-[#1e3a5f] text-white z-40 flex flex-col transition-transform duration-300',
          // Mobile default: hidden, shown via mobileOpen
          '-translate-x-full md:translate-x-0',
          // If mobileOpen on mobile, force show
          mobileOpen && 'translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">Conexus</h1>
            <p className="text-xs text-white/60 mt-0.5">Agenda Diária</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Desktop collapse */}
            <button
              onClick={onToggle}
              className="hidden md:flex text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Esconder menu"
              title="Esconder menu lateral"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            {/* Mobile close */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-white/60 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {filteredItems?.map((item: any) => {
            const isActive = pathname === item?.href
            return (
              <Link
                key={item?.href}
                href={item?.href ?? '/conexus'}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white border-r-2 border-[#f97316]'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item?.label}
              </Link>
            )
          })}
        </nav>

        {/* User info + Logout */}
        <div className="p-4 border-t border-white/10 space-y-3">
          {session?.user && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-sm font-bold">
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.user.name}</p>
                <p className="text-[10px] text-white/50 truncate">
                  {isAdmin ? 'Administrador' : 'Colaborador'}
                </p>
              </div>
            </div>
          )}
          <Link
            href={temGestao ? '/' : '/ponto/colaborador'}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {temGestao ? 'Voltar à Gestão' : 'Voltar ao Ponto'}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Terminar sessão
          </button>
        </div>
      </aside>
    </>
  )
}
