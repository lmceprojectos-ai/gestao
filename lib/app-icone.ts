import type { Metadata } from 'next';

// Cada botão destacado (Ponto, Parceiros, Conexus, Redes Sociais) é instalável
// como uma app própria no telemóvel ("Adicionar ao ecrã principal"): manifesto e
// ícone próprios em public/manifests e public/icones.
export function metadataApp(app: 'ponto' | 'parceiros' | 'conexus' | 'redes-sociais', titulo: string): Metadata {
  return {
    manifest: `/manifests/${app}.webmanifest`,
    icons: {
      icon: [
        { url: `/icones/${app}-192.png`, type: 'image/png', sizes: '192x192' },
        { url: `/icones/${app}-512.png`, type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: `/icones/${app}-180.png`, sizes: '180x180' }],
    },
    appleWebApp: { capable: true, title: titulo, statusBarStyle: 'default' },
  };
}
