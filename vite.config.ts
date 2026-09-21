// defineConfig is imported from 'vitest/config' rather than 'vite' so the
// `test` block below type-checks. It is the same function Vite exports, with
// the test options added — one config file instead of two that can drift.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// CSS Modules need no configuration in Vite: any file named *.module.css is
// automatically scoped. That is the whole reason we picked them over a CSS
// framework — no build step to own, no class-name conventions to remember.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // api/ is covered too: the passcode gate is worth testing directly.
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
