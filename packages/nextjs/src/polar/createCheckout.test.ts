import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ai-billing/narev', () => ({
  createNarevClient: vi.fn(),
}));

import { createNarevClient } from '@ai-billing/narev';
import { createCheckout } from './createCheckout.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NAREV_API_KEY = 'test-key';
});

describe('createCheckout', () => {
  it('returns checkout URL on success', async () => {
    vi.mocked(createNarevClient).mockReturnValueOnce({
      createCheckout: vi.fn().mockResolvedValueOnce({
        data: { url: 'https://polar.sh/checkout/sess_abc' },
      }),
    } as unknown as ReturnType<typeof createNarevClient>);

    const url = await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(url).toBe('https://polar.sh/checkout/sess_abc');
  });

  it('throws when checkout fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(createNarevClient).mockReturnValueOnce({
      createCheckout: vi.fn().mockRejectedValueOnce(new Error('API error')),
    } as unknown as ReturnType<typeof createNarevClient>);

    await expect(
      createCheckout('pkg_1', 'user_1', 'https://myapp.com'),
    ).rejects.toThrow('Failed to create checkout');
    consoleError.mockRestore();
  });
});
