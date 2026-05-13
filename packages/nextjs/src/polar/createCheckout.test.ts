import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@polar-sh/sdk', () => ({
  Polar: vi.fn(),
}));

import { Polar } from '@polar-sh/sdk';
import { createCheckout } from './createCheckout.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCheckout', () => {
  it('returns checkout URL on success', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'pat_test';
    process.env.POLAR_SERVER = 'sandbox';

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.checkouts = {
          create: vi.fn().mockResolvedValueOnce({
            url: 'https://checkout.polar.sh/pay/abc',
          }),
        };
      },
    );

    const url = await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(url).toBe('https://checkout.polar.sh/pay/abc');
  });

  it('throws when checkout fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    process.env.POLAR_ACCESS_TOKEN = 'pat_test';
    process.env.POLAR_SERVER = 'sandbox';

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.checkouts = {
          create: vi.fn().mockRejectedValueOnce(new Error('Stripe error')),
        };
      },
    );

    await expect(
      createCheckout('pkg_1', 'user_1', 'https://myapp.com'),
    ).rejects.toThrow('Failed to create checkout');
    consoleError.mockRestore();
  });

  it('defaults to sandbox when POLAR_SERVER is not set', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'pat_test';
    delete process.env.POLAR_SERVER;

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.checkouts = {
          create: vi.fn().mockResolvedValueOnce({
            url: 'https://checkout.polar.sh/pay/abc',
          }),
        };
      },
    );

    const url = await createCheckout('pkg_1', 'user_1', 'https://myapp.com');
    expect(url).toBe('https://checkout.polar.sh/pay/abc');
  });
});
