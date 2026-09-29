import { soAdmin } from '@/lib/conexus/so-admin'
import { AppLayout } from '@/components/conexus/app-layout'
import { SettingsClient } from '@/components/conexus/settings-client'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  await soAdmin()
  return (
    <AppLayout>
      <SettingsClient />
    </AppLayout>
  )
}
