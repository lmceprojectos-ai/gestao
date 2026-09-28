'use client'
import { useConta } from '@/components/parceiros/conta'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, ArrowLeftRight, Building2, ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  user: { name: string; email: string; company: string | null; isAdmin: boolean; temGestao?: boolean }
}

function companyLabel(company: string | null, isAdmin: boolean, nome: string): string {
  if (company === 'CRIACONSENSOS') return 'Criaconsensos'
  if (company === 'PARCEIRO') return nome
  if (isAdmin) return 'Administrador'
  return 'Utilizador'
}

// Cabeçalho da área Parceiros (conta corrente). Quem também usa a Gestão tem o
// botão para voltar; os parceiros só veem a sua conta.
export function AppHeader({ user }: Props) {
  const conta = useConta()
  return (
    <header className="sticky top-0 z-40 w-full bg-primary/95 backdrop-blur shadow-md">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-bold tracking-tight text-primary-foreground leading-tight truncate">
                CONTA CORRENTE · CRIACONSENSOS{conta.id ? <> ↔ {conta.nome.toUpperCase()}</> : null}
              </p>
              <p className="text-[11px] sm:text-xs text-primary-foreground/70 leading-tight truncate">
                Registo de transações, serviços e saldo corrente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary-foreground/80" />
              <span className="text-xs font-medium text-primary-foreground">
                {companyLabel(user?.company ?? null, Boolean(user?.isAdmin), conta.nome)}
              </span>
            </div>
            {user?.isAdmin && conta.id ? (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href="/parceiros">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Parceiros</span>
                </Link>
              </Button>
            ) : null}
            {user?.temGestao ? (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Voltar à Gestão</span>
                </Link>
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
