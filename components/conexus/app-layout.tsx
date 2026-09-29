'use client'

import { useState, useEffect } from 'react'
import { AppSidebar } from './app-sidebar'
import { ReminderChecker } from './reminder-checker'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  // Before mount, render with sidebar visible (default) to avoid layout shift
  const isCollapsed = mounted ? collapsed : false

  return (
    <div className="min-h-screen bg-background">
      <ReminderChecker />
      <AppSidebar collapsed={isCollapsed} onToggle={toggle} />
      <main
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: isCollapsed ? 0 : undefined }}
      >
        {/* When sidebar is open (not collapsed), add left margin on md+ */}
        <div className={isCollapsed ? '' : 'md:ml-64'}>
          <div className="w-full px-3 sm:px-4 py-6 transition-all duration-300">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
