"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, ShieldCheck, User, KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { hasGestaoAccess } from "@/lib/ponto/roles";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ponto/theme-toggle";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AppHeader({
  name,
  role,
  email,
  canBeAdmin = false,
}: {
  name: string;
  role: string;
  email?: string;
  canBeAdmin?: boolean;
}) {
  const isAdmin = role === "ADMIN";
  const router = useRouter();

  // Alterna para a vista de administração do ponto (apenas administradores).
  function verComoAdministrador() {
    document.cookie = "ponto_view_mode=admin; path=/; max-age=31536000; samesite=lax";
    router.push("/ponto/admin");
    router.refresh();
  }
  const { data: session } = useSession() || {};
  const canManage = hasGestaoAccess((session?.user as any)?.role ?? role);
  const [sending, setSending] = useState(false);

  async function requestPasswordChange() {
    setSending(true);
    try {
      const res = await fetch("/api/ponto/password/request", { method: "POST" });
      if (res.ok) {
        toast.success("Enviámos um email com o link para alterar a palavra-passe. Verifique a sua caixa de correio.");
      } else {
        toast.error("Não foi possível enviar o email. Tente novamente.");
      }
    } catch {
      toast.error("Não foi possível enviar o email. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1200px] px-3 sm:px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
            <Image src="/logo-icon.png" alt="Criaconsensos" fill className="object-contain p-1" sizes="44px" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="font-display font-bold tracking-tight truncate">Criaconsensos</p>
            <p className="text-xs text-muted-foreground truncate">Livro de Ponto</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground">
            {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-secondary-foreground/80">· {isAdmin ? "Administrador" : "Colaborador"}</span>
          </div>
          <ThemeToggle />

          {/* Ver como administrador (apenas administradores do ponto) */}
          {canBeAdmin && (
            <Button variant="default" size="sm" title="Ver como administrador" onClick={verComoAdministrador}>
              <ShieldCheck className="h-4 w-4" />
              <span className="lg:hidden">Admin</span>
              <span className="hidden lg:inline">Ver como administrador</span>
            </Button>
          )}

          {/* Alterar palavra-passe */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" title="Alterar palavra-passe">
                <KeyRound className="h-4 w-4" />
                <span className="lg:hidden">Palavra-passe</span>
                <span className="hidden lg:inline">Palavra-passe</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alterar palavra-passe</AlertDialogTitle>
                <AlertDialogDescription>
                  Vamos enviar um email para o endereço da sua conta com um link seguro para definir uma nova palavra-passe. O link é válido durante 1 hora.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={requestPasswordChange} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Enviar email
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {canManage && (
            <Button variant="outline" size="sm" title="Voltar à Gestão" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="lg:hidden">Gestão</span>
              <span className="hidden lg:inline">Voltar à Gestão</span>
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
