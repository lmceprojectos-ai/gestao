'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Credenciais inválidas. Tente novamente.');
      } else {
        // Reencaminha conforme o perfil. Contas com acesso à Gestão vão para a
        // Gestão (mesmo que também piquem ponto). Contas exclusivas do ponto vão
        // para o ecrã adequado do módulo de ponto.
        const session = await getSession();
        const role = String(((session?.user as any)?.role) ?? '').toLowerCase();
        const pontoRoleValue = String(((session?.user as any)?.pontoRole) ?? '').toUpperCase();
        const hasGestao = role === 'admin' || role === 'editor' || role === 'leitura' || role === 'insercao';
        const eff = pontoRoleValue || role.toUpperCase();
        if (!hasGestao && eff === 'QR') {
          router.replace('/ponto/presenca');
        } else if (!hasGestao && eff === 'COLABORADOR') {
          router.replace('/ponto/colaborador');
        } else {
          router.replace('/');
        }
      }
    } catch (err: any) {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#1a3352] to-[#0d9488] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm mb-4 overflow-hidden">
            <Image src="/logo-criaconsensos.png" alt="CRIACONSENSOS" width={80} height={80} className="object-contain" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">CRIACONSENSOS</h1>
          <p className="text-white/70 mt-1">Gestão Financeira</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar Sessão</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-gray-900"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  id="current-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-gray-900"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium text-sm hover:bg-[#162d4a] transition-colors disabled:opacity-60"
            >
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-[#0d9488] font-medium hover:underline">
              Esqueci-me da palavra-passe
            </Link>
          </p>
          <p className="mt-4 text-center text-sm text-gray-500">
            Não tem conta?{' '}
            <Link href="/signup" className="text-[#0d9488] font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
