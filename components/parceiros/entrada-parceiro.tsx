'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Entrada de um parceiro (página do link de convite): entrar ou criar conta.
export function EntradaParceiro({ nome, slug, codigo }: { nome: string; slug: string; codigo: string }) {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const destino = `/parceiros/${slug}`;

  const entrar = async (email: string, password: string) => {
    const r = await signIn('credentials', { email, password, redirect: false });
    if (r?.error) throw new Error('Email ou palavra-passe incorretos.');
    window.location.href = destino;
  };

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setAEnviar(true);
    try {
      if (modo === 'criar') {
        const r = await fetch('/api/parceiros/registo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, parceiro: slug, c: codigo }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || 'Não foi possível criar a conta.');
      }
      await entrar(form.email, form.password);
    } catch (e: any) {
      setErro(e.message);
      setAEnviar(false);
    }
  };

  const campo = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center"><ArrowLeftRight className="h-5 w-5" /></div>
          <div>
            <p className="font-display font-bold text-sm sm:text-base">CONTA CORRENTE · CRIACONSENSOS ↔ {nome.toUpperCase()}</p>
            <p className="text-xs text-primary-foreground/70">Acesso da {nome}</p>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl bg-card shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            {(['entrar', 'criar'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setModo(m); setErro(''); }}
                className={`rounded-md py-1.5 font-medium ${modo === m ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>
          <form onSubmit={submeter} className="space-y-4">
            {modo === 'criar' && (
              <div className="space-y-1.5"><Label htmlFor="nome">Nome</Label><Input id="nome" required autoComplete="name" {...campo('name')} /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" {...campo('email')} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">Palavra-passe</Label>
              <Input id="pass" type="password" required minLength={modo === 'criar' ? 8 : undefined} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} {...campo('password')} />
              {modo === 'criar' && <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>}
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={aEnviar} className="w-full gap-1.5">
              {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{modo === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
            </Button>
          </form>
          <p className="text-center text-sm"><Link href="/forgot-password" className="text-primary font-medium hover:underline">Esqueci-me da palavra-passe</Link></p>
          <p className="text-center text-xs text-muted-foreground">Esta conta dá acesso apenas à conta corrente entre a {nome} e a Criaconsensos.</p>
        </div>
      </main>
    </div>
  );
}
