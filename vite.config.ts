import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { build as viteBuild, defineConfig, type Plugin } from 'vite';
import manifest from './src/manifest.json';

const injectEntry = path.resolve(__dirname, 'src/inject/inject.ts');
const pageBridgeEntry = path.resolve(__dirname, 'src/inject/page-bridge.ts');
const injectOutDir = path.resolve(__dirname, 'public/inject');

async function buildInjectFile(
  entry: string,
  fileName: string,
  emptyOutDir: boolean
) {
  await viteBuild({
    configFile: false,
    build: {
      lib: {
        entry,
        name: 'TvQuantInject',
        formats: ['iife'],
        fileName: () => fileName,
      },
      outDir: injectOutDir,
      emptyOutDir,
      minify: process.env.NODE_ENV === 'production',
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}

async function buildInjectBundle() {
  await buildInjectFile(injectEntry, 'main-world.js', true);
  await buildInjectFile(pageBridgeEntry, 'page-bridge.js', false);
}

function injectIifePlugin(): Plugin {
  return {
    name: 'inject-iife',
    async buildStart() {
      await buildInjectBundle();
    },
    async closeBundle() {
      await buildInjectBundle();
    },
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        void buildInjectBundle();
      });
    },
  };
}

export default defineConfig({
  base: '',
  plugins: [react(), tailwindcss(), crx({ manifest }), injectIifePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
