import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
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
