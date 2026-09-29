'use client';

import { useEffect } from 'react';

// Os diálogos abrem fora da página (no <body>): o tema do Conexus aplica-se
// também ao body enquanto se está nesta área.
export function TemaConexus() {
  useEffect(() => {
    document.body.classList.add('conexus-theme');
    return () => document.body.classList.remove('conexus-theme');
  }, []);
  return null;
}
