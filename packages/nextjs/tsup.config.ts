import { defineConfig, type Options } from 'tsup';

const common: Options = {
  entry: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  format: ['cjs', 'esm'],
  bundle: false,
  clean: true,
  dts: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'next', '@polar-sh/sdk', 'stripe'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
};

export default defineConfig([common]);
