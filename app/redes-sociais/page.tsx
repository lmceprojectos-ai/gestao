import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { canSocialAccess } from '@/lib/social/guard';
import RedesClient from './redes-client';

export const dynamic = 'force-dynamic';

export default async function RedesSociaisPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any).role;
  if (!canSocialAccess(role)) redirect('/');
  return <RedesClient />;
}
