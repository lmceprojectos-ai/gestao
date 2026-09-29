const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
    // O servidor (cPanel) tem 2 GB de memória: compilar com um só processo.
    cpus: 1,
    workerThreads: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // NEXT_SKIP_TYPECHECK=1 salta a verificação de tipos (máquina de compilação com pouca memória).
    ignoreBuildErrors: !!process.env.NEXT_SKIP_TYPECHECK,
  },
  images: { unoptimized: true },
  webpack: (config, { dev, isServer }) => {
    // Pouco espaço em disco na máquina de compilação: sem cache persistente do webpack.
    if (process.env.NEXT_NO_WEBPACK_CACHE) config.cache = false;
    if (!isServer) {
      // Content hashes only exist in a production compilation. `next dev` builds chunks on
      // demand, so [contenthash] resolves to undefined and the browser requests
      // static/chunks/undefined.js, which 404s and breaks navigation in the dev preview.
      if (!dev) {
        config.output.filename = 'static/chunks/[name]-[contenthash:8].js';
        config.output.chunkFilename = 'static/chunks/[contenthash:16].js';
      }
    }
    return config;
  },
};

const fs = require('fs');
const userConfigPath = path.join(__dirname, 'next.config.user.json');
const userConfigAllowedKeys = { skipTrailingSlashRedirect: 'boolean', trailingSlash: 'boolean' };
if (fs.existsSync(userConfigPath)) {
  const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
  for (const key of Object.keys(userConfig)) {
    if (typeof userConfig[key] !== userConfigAllowedKeys[key]) {
      throw new Error(`next.config.user.json: unsupported override "${key}". Supported boolean keys: skipTrailingSlashRedirect, trailingSlash.`);
    }
    nextConfig[key] = userConfig[key];
  }
}

module.exports = nextConfig;
