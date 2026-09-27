import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` -> `./src/*` mapping in tsconfig.json and the app's
    // own resolution. Without this, any module that imports through the alias
    // simply cannot be tested - the import fails to resolve at collection time.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
