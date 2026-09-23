'use client';

import { useSession } from 'next-auth/react';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <TopBar />
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
