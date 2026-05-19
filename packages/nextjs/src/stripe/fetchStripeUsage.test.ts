import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchStripeUsage } from './fetchStripeUsage.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NAREV_API_KEY = 'test-key';
});

describe('fetchStripeUsage', () => {
  it('returns aggregated value from Narev balance', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
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
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 2.5, found: true });
  });

  it('returns empty when not found', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
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
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
  });

  it('returns empty on Narev API error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockRejectedValueOnce(new Error('API down')),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchStripeUsage('cus_1');
    expect(result).toEqual({ aggregatedValue: 0, found: false });
    consoleError.mockRestore();
  });
});
