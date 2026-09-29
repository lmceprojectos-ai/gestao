import { soAdmin } from '@/lib/conexus/so-admin'
import { AppLayout } from '@/components/conexus/app-layout'
import { CollaboratorsClient } from '@/components/conexus/collaborators-client'

export const dynamic = 'force-dynamic'

export default async function ColaboradoresPage() {
  await soAdmin()
  return (
    <AppLayout>
      <CollaboratorsClient />
    </AppLayout>
  )
}
