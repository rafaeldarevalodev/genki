import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // React 19 strict mode double-invokes effects, which causes WaveSurfer's
    // internal abortController.abort() to fire async AbortError after cleanup
    // — this is the exact bug being tested, so strict mode is disabled to
    // isolate the component logic without the double-invoke noise.
    setupFiles: [],
  },
});
