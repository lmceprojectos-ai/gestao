import { redirect } from 'next/navigation';

// Registo público desativado (ver app/api/signup/route.ts).
export default function SignupPage() {
  redirect('/login');
}
