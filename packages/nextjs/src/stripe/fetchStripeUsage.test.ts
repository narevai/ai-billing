import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ai-billing/narev', () => ({
  createNarevClient: vi.fn(),
}));

import { createNarevClient } from '@ai-billing/narev';
import { fetchStripeUsage } from './fetchStripeUsage.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NAREV_API_KEY = 'test-key';
});

describe('fetchStripeUsage', () => {
  it('returns aggregated value from Narev balance', async () => {
    vi.mocked(createNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockResolvedValueOnce({
        data: {
          unitsBalance: 50,
          unitsConsumed: 2.5,
          unitsCredited: 100,
          unit: 'nanos',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      }),
    } as unknown as ReturnType<typeof createNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 2.5, found: true });
  });

  it('returns empty when not found', async () => {
    vi.mocked(createNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockResolvedValueOnce({
        data: {
          unitsBalance: null,
          unitsConsumed: 0,
          unitsCredited: null,
          unit: 'nanos',
          currency: 'USD',
          meterName: 'Usage',
          found: false,
        },
      }),
    } as unknown as ReturnType<typeof createNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
  });

  it('returns empty on Narev API error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(createNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockRejectedValueOnce(new Error('API down')),
    } as unknown as ReturnType<typeof createNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
    consoleError.mockRestore();
  });
});
