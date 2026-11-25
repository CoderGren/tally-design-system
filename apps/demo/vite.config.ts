/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const ui = (p: string) => fileURLToPath(new URL(`../../packages/ui/src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Consume the design system from source: no prebuild step, instant HMR across packages.
    alias: [
      { find: '@tally/ui/styles.css', replacement: ui('styles/index.css') },
      { find: /^@tally\/ui$/, replacement: ui('index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
