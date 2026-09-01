import { describe, it, expect } from 'vitest';
import { createCheckout } from './createCheckout.js';

describe('createCheckout', () => {
  it('returns mock checkout URL on success', async () => {
    const url = await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(url).toBe('https://sandbox.polar.sh/mock-checkout');
  });
});