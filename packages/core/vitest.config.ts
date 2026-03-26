import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['packages/core/src/error/**', '**/*.test.ts'],
    },
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
