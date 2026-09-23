'use client';

import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError('Ocorreu um erro. Tente novamente.');
      } else {
        setSent(true);
      }
    } catch (err) {
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
          {sent ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifique o seu email</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Se existir uma conta associada a este email, receberá uma mensagem com uma ligação para repor a palavra-passe. A ligação é válida durante 1 hora.
              </p>
              <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-[#0d9488] font-medium hover:underline">
                <ArrowLeft className="h-4 w-4" /> Voltar ao início de sessão
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Repor palavra-passe</h2>
              <p className="text-sm text-gray-600 mb-6">
                Introduza o email da sua conta e enviaremos uma ligação para definir uma nova palavra-passe.
              </p>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-gray-900"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium text-sm hover:bg-[#162d4a] transition-colors disabled:opacity-60"
                >
                  {loading ? 'A enviar...' : 'Enviar ligação de reposição'}
                </button>
              </form>
              <p className="mt-4 text-center">
                <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="h-4 w-4" /> Voltar ao início de sessão
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
