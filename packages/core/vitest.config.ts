import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    globals: true, 
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});