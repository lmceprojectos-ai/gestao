'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Clock, ShieldCheck, PenLine, Eye, FilePlus, User as UserIcon } from 'lucide-react';

const ROLE_META: Record<string, { label: string; cor: string; icon: any }> = {
  admin: { label: 'Administrador', cor: 'bg-blue-100 text-blue-700', icon: ShieldCheck },
  editor: { label: 'Editor', cor: 'bg-emerald-100 text-emerald-700', icon: PenLine },
  insercao: { label: 'Operativo', cor: 'bg-violet-100 text-violet-700', icon: FilePlus },
  leitura: { label: 'Leitura', cor: 'bg-slate-100 text-slate-700', icon: Eye },
};

export function TopBar() {
  const { data: session } = useSession() || {};
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const user = session?.user as any;
  if (!user) return null;

  const role = user.role || 'leitura';
  const meta = ROLE_META[role] || ROLE_META.leitura;
  const RoleIcon = meta.icon;
  const name = user.name || user.email || 'Utilizador';

  const dateStr = now
    ? now.toLocaleDateString('pt-PT', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Lisbon',
      })
    : '';
  const timeStr = now
    ? now.toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Lisbon',
      })
    : '';

  return (
    <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between gap-4 pl-16 pr-4 sm:px-6 lg:px-8 py-2.5">
        {/* Utilizador */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
            <UserIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{name}</p>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${meta.cor}`}>
              <RoleIcon className="h-2.5 w-2.5" />
              {meta.label}
            </span>
          </div>
        </div>

        {/* Data / hora */}
        <div className="flex items-center gap-2 text-right">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="leading-tight" suppressHydrationWarning>
            <p className="text-sm font-medium text-foreground tabular-nums">{timeStr || '——:——:——'}</p>
            <p className="hidden sm:block text-[11px] text-muted-foreground capitalize">{dateStr}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
