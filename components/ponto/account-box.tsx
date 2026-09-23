"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, KeyRound, Loader2, User } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Caixa de conta para o menu lateral escuro: identidade, alterar
// palavra-passe e terminar sessão.
export function AccountBox({ name }: { name: string; email?: string }) {
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

  const itemCls = "flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-black hover:bg-black/10 hover:text-black transition-colors";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <div className="h-8 w-8 rounded-full bg-black/15 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-black" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-black truncate">{name}</p>
          <p className="text-[11px] text-black/70 truncate">Administrador</p>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className={itemCls}>
            <KeyRound className="h-4 w-4 shrink-0" />Palavra-passe
          </button>
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

      <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`${itemCls} hover:bg-rose-600/20 hover:text-rose-900`}>
        <LogOut className="h-4 w-4 shrink-0" />Sair
      </button>
    </div>
  );
}
