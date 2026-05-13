import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./fetchStripeConfig.js', () => ({
  fetchStripeConfig: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn(),
}));

import { fetchStripeConfig } from './fetchStripeConfig.js';
import Stripe from 'stripe';
import { fetchStripeUsage } from './fetchStripeUsage.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchStripeUsage', () => {
  it('returns empty when config is null', async () => {
    vi.mocked(fetchStripeConfig).mockResolvedValueOnce(null);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
  });

  it('returns empty when meterId is missing', async () => {
    vi.mocked(fetchStripeConfig).mockResolvedValueOnce({ meterId: '' });

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
  });

  it('converts nano-units to dollars', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    vi.mocked(fetchStripeConfig).mockResolvedValueOnce({ meterId: 'mtr_1' });

    vi.mocked(Stripe).mockImplementation(
      function (this: Record<string, unknown>) {
        this.billing = {
          meters: {
            listEventSummaries: vi.fn().mockResolvedValueOnce({
              data: [
                { aggregated_value: 1_500_000_000 },
                { aggregated_value: 500_000_000 },
              ],
              has_more: false,
            }),
          },
        };
      },
    );

    const result = await fetchStripeUsage('cus_1');
    expect(result.aggregatedValue).toBe(2); // 2e9 / 1e9 = 2
    expect(result.found).toBe(true);
  });

  it('returns empty on Stripe API error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    vi.mocked(fetchStripeConfig).mockResolvedValueOnce({ meterId: 'mtr_1' });

    vi.mocked(Stripe).mockImplementation(
      function (this: Record<string, unknown>) {
        this.billing = {
          meters: {
            listEventSummaries: vi
              .fn()
              .mockRejectedValueOnce(new Error('No such customer')),
          },
        };
      },
    );

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
    consoleError.mockRestore();
  });
});
