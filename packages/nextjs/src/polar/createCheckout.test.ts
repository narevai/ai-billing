import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { createCheckout } from './createCheckout.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCheckout', () => {
  it('returns the passed successUrl as the checkout URL', async () => {
    const url = await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(url).toBe('https://myapp.com');
  });

  it('is harmless for any productId/userId combination', async () => {
    const url = await createCheckout(
      'pkg_2',
      'user_2',
      'https://myapp.com/success',
    );
    expect(url).toBe('https://myapp.com/success');
  });

  it('does not call getNarevClient', async () => {
    await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(getNarevClient).not.toHaveBeenCalled();
  });
});
