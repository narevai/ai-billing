import { expect, test } from 'vitest';
import { initializeBilling, version } from './index.js';
import pkg from '../package.json' with { type: 'json' };

test('initializeBilling returns the correct string', () => {
  const result = initializeBilling({
    apiKey: 'sk_test_123',
    provider: 'polar',
  });

  expect(version).toBe(pkg.version);
  expect(result).toContain(`ai-billing core v${version}`);
});
