import { defineConfig, type Options } from 'tsup';

const commonConfig: Options = {
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@ai-sdk/provider'],
};

export default defineConfig([
  {
    ...commonConfig,
    entry: ['src/index.ts'],
    outDir: 'dist',
  },
]);
