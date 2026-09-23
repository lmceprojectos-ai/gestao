"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, LogOut, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Ecrã dedicado que mostra apenas o QR de presença rotativo.
// Utilizado pela conta exclusiva do ecrã/tablet colocado à entrada.
export function PresencaClient() {
  const [data, setData] = useState<{ token: string; windowMs: number; msLeft: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const loadPresence = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/admin/presence");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setSecondsLeft(Math.ceil((d?.msLeft ?? 0) / 1000));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPresence();
    const t = setInterval(loadPresence, 10000);
    return () => clearInterval(t);
  }, [loadPresence]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          loadPresence();
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loadPresence]);

  async function regenerate() {
    setSaving(true);
    try {
      const res = await fetch("/api/ponto/admin/presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      if (res.ok) {
        toast.success("Código de segurança renovado. Os QR anteriores deixaram de ser válidos.");
        loadPresence();
      } else {
        toast.error("Erro ao renovar o código.");
      }
    } catch {
      toast.error("Erro ao renovar o código.");
    } finally {
      setSaving(false);
    }
  }

  const qrValue = data?.token ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1200px] px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden">
              <Image src="/logo-icon.png" alt="Criaconsensos" fill className="object-contain p-1" sizes="44px" />
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold tracking-tight">Criaconsensos</p>
              <p className="text-xs text-muted-foreground">Ecrã de Presença</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-md bg-card rounded-2xl p-8 flex flex-col items-center text-center"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <p className="font-semibold text-xl mb-1 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />QR de presença
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Mostre este código à entrada. Os colaboradores apontam a câmara da aplicação para registar a marcação. O código muda automaticamente a cada 30 segundos.
          </p>
          <div className="bg-white p-5 rounded-2xl border">
            {qrValue ? (
              <QRCodeSVG value={qrValue} size={280} level="M" marginSize={4} />
            ) : (
              <div className="h-[280px] w-[280px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">
              Novo código em <span className="font-mono font-semibold text-foreground">{secondsLeft}s</span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="mt-5" onClick={regenerate} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-1" />Renovar código de segurança
          </Button>
        </div>
      </main>
    </div>
  );
}
