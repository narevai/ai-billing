import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.test.ts'],
    },
    projects: [
      {
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          exclude: ['node_modules/**'],
        },
      },
      {
        test: {
          name: 'edge',
          globals: true,
          environment: 'edge-runtime',
          typecheck: {
            enabled: true,
            tsconfig: './tsconfig.edge.json',
          },
        },
      },
    ],
  },
});
