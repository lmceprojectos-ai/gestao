'use client';

import { useEffect } from 'react';

// Os diálogos abrem fora da página (no <body>): o tema dos Parceiros é aplicado
// também ao body enquanto se está nesta área.
export function TemaParceiros() {
  useEffect(() => {
    document.body.classList.add('parceiros-theme');
    return () => document.body.classList.remove('parceiros-theme');
  }, []);
  return null;
}
