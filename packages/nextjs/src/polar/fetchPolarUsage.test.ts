import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./fetchPolarConfig.js', () => ({
  fetchPolarConfig: vi.fn(),
}));

vi.mock('@polar-sh/sdk', () => ({
  Polar: vi.fn(),
}));

import { fetchPolarConfig } from './fetchPolarConfig.js';
import { Polar } from '@polar-sh/sdk';
import { fetchPolarUsage } from './fetchPolarUsage.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchPolarUsage', () => {
  it('returns empty when config is null', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce(null);

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    });
  });

  it('returns empty when meterId is missing', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: '',
      environment: 'sandbox',
      topup: [],
    });

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    });
  });

  it('returns usage data when meter exists', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'sandbox',
      topup: [],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.customerMeters = {
          list: vi.fn().mockResolvedValueOnce({
            result: {
              items: [
                {
                  consumedUnits: 42,
                  creditedUnits: 100,
                  meter: { name: 'Tokens' },
                },
              ],
            },
          }),
        };
      },
    );

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 42,
      creditedUnits: 100,
      meterName: 'Tokens',
      found: true,
    });
  });

  it('returns empty when meter has no items', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'sandbox',
      topup: [],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.customerMeters = {
          list: vi.fn().mockResolvedValueOnce({ result: { items: [] } }),
        };
      },
    );

    const result = await fetchPolarUsage('user_1');
    expect(result).toEqual({
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    });
  });

  it('returns empty when Polar API throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'sandbox',
      topup: [],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.customerMeters = {
          list: vi.fn().mockRejectedValueOnce(new Error('API error')),
        };
      },
    );

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
