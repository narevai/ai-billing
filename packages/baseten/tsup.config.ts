import { defineConfig, type Options } from 'tsup';

const pkg = await import('./package.json', { with: { type: 'json' } });
const version = pkg.default.version;

const commonConfig: Options = {
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
  external: ['@ai-sdk/provider'],
};

export default defineConfig([
  {
    ...commonConfig,
    entry: ['src/index.ts'],
    outDir: 'dist',
  },
]);
