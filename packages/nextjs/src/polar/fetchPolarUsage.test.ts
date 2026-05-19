import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchPolarUsage } from './fetchPolarUsage.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NAREV_API_KEY = 'test-key';
});

describe('fetchPolarUsage', () => {
  it('returns usage data from Narev balance', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockResolvedValueOnce({
        data: {
          unitsBalance: 50,
          unitsConsumed: 42,
          unitsCredited: 100,
          unit: 'base',
          currency: 'USD',
          meterName: 'Tokens',
          found: true,
        },
      }),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 42,
      creditedUnits: 100,
      meterName: 'Tokens',
      found: true,
    });
  });

  it('maps null creditedUnits to 0', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockResolvedValueOnce({
        data: {
          unitsBalance: null,
          unitsConsumed: 10,
          unitsCredited: null,
          unit: 'base',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      }),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 10,
      creditedUnits: 0,
      meterName: 'Usage',
      found: true,
    });
  });

  it('returns empty when not found', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockResolvedValueOnce({
        data: {
          unitsBalance: null,
          unitsConsumed: 0,
          unitsCredited: null,
          unit: 'base',
          currency: 'USD',
          meterName: 'Usage',
          found: false,
        },
      }),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    });
  });

  it('returns empty when Narev API throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getBalance: vi.fn().mockRejectedValueOnce(new Error('API error')),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    });
    consoleError.mockRestore();
  });
});
