import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { build as viteBuild, defineConfig, type Plugin } from 'vite';
import manifest from './src/manifest.json';

const injectEntry = path.resolve(__dirname, 'src/inject/inject.ts');
const injectOutDir = path.resolve(__dirname, 'dist/inject');

async function buildInjectBundle() {
  await viteBuild({
    configFile: false,
    build: {
      lib: {
        entry: injectEntry,
        name: 'TvQuantInject',
        formats: ['iife'],
        fileName: () => 'main-world.js',
      },
      outDir: injectOutDir,
      emptyOutDir: true,
      minify: process.env.NODE_ENV === 'production',
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}

function injectIifePlugin(): Plugin {
  return {
    name: 'inject-iife',
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
