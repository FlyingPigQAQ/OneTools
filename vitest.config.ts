import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Vitest config. The pure modules under test import via the `@shared` path
// alias declared in tsconfig — replicate it here so resolution works outside
// the electron-vite build. Only the main/shared code is tested (the renderer
// pulls in Electron-bridged APIs and the DOM, so it's out of scope for unit
// tests); the `@renderer` alias is included for completeness.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
