import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/components/**/*.test.{ts,tsx}'],
    // React 19 strict mode double-invokes effects, which causes WaveSurfer's
    // internal abortController.abort() to fire async AbortError after cleanup
    // — this is the exact bug being tested, so strict mode is disabled to
    // isolate the component logic without the double-invoke noise.
    setupFiles: [],
  },
});