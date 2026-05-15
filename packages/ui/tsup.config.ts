import { defineConfig, type Options } from 'tsup';

const common: Options = {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  bundle: true,
  clean: true,
  dts: true,
  sourcemap: true,
  external: ['react'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
};

export default defineConfig([common]);
