"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Lock, Loader2, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ResetClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      if (!token) {
        if (active) { setValid(false); setChecking(false); }
        return;
      }
      try {
        const res = await fetch(`/api/ponto/password/reset?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (active) { setValid(!!data?.valid); setChecking(false); }
      } catch {
        if (active) { setValid(false); setChecking(false); }
      }
    }
    check();
    return () => { active = false; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ponto/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao alterar a palavra-passe.");
        if (res.status === 400) setValid(false);
      } else {
        setDone(true);
        toast.success("Palavra-passe alterada com sucesso.");
      }
    } catch {
      toast.error("Erro ao alterar a palavra-passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="relative h-14 w-14 rounded-2xl bg-white border border-border flex items-center justify-center overflow-hidden">
            <Image src="/logo-icon.png" alt="Criaconsensos" fill className="object-contain p-1" sizes="56px" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Criaconsensos</h1>
            <p className="text-muted-foreground text-xs">Livro de Ponto</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-8" style={{ boxShadow: "var(--shadow-lg)" }}>
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm">A validar o link…</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight">Palavra-passe alterada</h2>
                <p className="text-muted-foreground text-sm mt-1">Já pode iniciar sessão com a nova palavra-passe.</p>
              </div>
              <Button className="w-full" onClick={() => router.replace("/login")}>Ir para o início de sessão</Button>
            </div>
          ) : !valid ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight">Link inválido ou expirado</h2>
                <p className="text-muted-foreground text-sm mt-1">O link já foi utilizado ou caducou. Solicite um novo na página de início de sessão.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => router.replace("/login")}>Voltar ao início de sessão</Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight mb-1">Nova palavra-passe</h2>
              <p className="text-muted-foreground text-sm mb-6">Defina a nova palavra-passe para a sua conta.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova palavra-passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar palavra-passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repita a palavra-passe" className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Guardar nova palavra-passe
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
