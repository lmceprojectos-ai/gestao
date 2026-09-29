import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'

// Páginas do Conexus só para administradores (colaboradores voltam ao Conexus).
export async function soAdmin() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') redirect('/conexus')
}
