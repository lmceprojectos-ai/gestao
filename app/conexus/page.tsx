import { Suspense } from 'react'
import { AppLayout } from '@/components/conexus/app-layout'
import { DashboardClient } from '@/components/conexus/dashboard-client'

export default function HomePage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">A carregar...</div></div>}>
        <DashboardClient />
      </Suspense>
    </AppLayout>
  )
}
