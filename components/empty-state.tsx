'use client';

import { LucideIcon, Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Sem dados',
  description = 'Ainda não existem registos.',
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
