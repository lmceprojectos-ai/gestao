import { Suspense } from 'react'
import { AppLayout } from '@/components/conexus/app-layout'
import { EisenhowerClient } from '@/components/conexus/eisenhower-client'

export default function MatrizPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">A carregar...</div></div>}>
        <EisenhowerClient />
      </Suspense>
    </AppLayout>
  )
}
