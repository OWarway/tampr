import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const DEV_RELOAD_MARKER_PATH = 'dev/reload.json';

export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'development' ? devReloadMarker() : undefined],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(projectRoot, 'src/background/service-worker.ts'),
        popup: resolve(projectRoot, 'popup.html'),
        workspace: resolve(projectRoot, 'workspace.html'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames(chunk) {
          return chunk.name === 'background'
            ? 'background/service-worker.js'
            : 'assets/[name]-[hash].js';
        },
      },
    },
    sourcemap: mode !== 'production',
  },
}));

function devReloadMarker(): Plugin {
  return {
    name: 'tampr-dev-reload-marker',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: DEV_RELOAD_MARKER_PATH,
        source: JSON.stringify({
          builtAt: new Date().toISOString(),
        }),
      });
    },
  };
}
