'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Erro ao criar conta');
        setLoading(false);
        return;
      }
      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError('Conta criada, mas erro ao iniciar sessão.');
      } else {
        router.replace('/');
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
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Criar Conta</h2>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-gray-900"
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="email"
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
                  type="password"
                  name="new-password"
                  id="new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-gray-900"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium text-sm hover:bg-[#162d4a] transition-colors disabled:opacity-60"
            >
              {loading ? 'A criar...' : 'Criar Conta'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#0d9488] font-medium hover:underline">
              Iniciar sessão
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
