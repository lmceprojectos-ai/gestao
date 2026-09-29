import { soAdmin } from '@/lib/conexus/so-admin'
import { AppLayout } from '@/components/conexus/app-layout'
import { HistoryClient } from '@/components/conexus/history-client'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  await soAdmin()
  return (
    <AppLayout>
      <HistoryClient />
    </AppLayout>
  )
}
