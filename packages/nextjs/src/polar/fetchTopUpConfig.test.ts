import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./fetchPolarConfig.js', () => ({
  fetchPolarConfig: vi.fn(),
}));

vi.mock('@polar-sh/sdk', () => ({
  Polar: vi.fn(),
}));

import { fetchPolarConfig } from './fetchPolarConfig.js';
import { Polar } from '@polar-sh/sdk';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchTopUpConfig', () => {
  it('returns empty packages when config is null', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce(null);

    const result = await fetchTopUpConfig();
    expect(result).toEqual({ packages: [] });
  });

  it('returns packages from config', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'sandbox',
      topup: [{ id: 'pkg_1', credits: 10, priceCents: 1000 }],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.organizations = {
          list: vi.fn().mockResolvedValueOnce({ result: { items: [] } }),
        };
      },
    );

    const result = await fetchTopUpConfig();
    expect(result.packages).toEqual([
      { id: 'pkg_1', credits: 10, priceCents: 1000 },
    ]);
    expect(result.taxBehavior).toBeUndefined();
  });

  it('includes tax behavior from org', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'production',
      topup: [],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.organizations = {
          list: vi.fn().mockResolvedValueOnce({
            result: { items: [{ defaultTaxBehavior: 'inclusive' }] },
          }),
        };
      },
    );

    const result = await fetchTopUpConfig();
    expect(result.taxBehavior).toBe('inclusive');
  });

  it('skips tax when org list throws', async () => {
    vi.mocked(fetchPolarConfig).mockResolvedValueOnce({
      meterId: 'mtr_1',
      environment: 'sandbox',
      topup: [{ id: 'pkg_1', credits: 5, priceCents: 500 }],
    });

    vi.mocked(Polar).mockImplementation(
      function (this: Record<string, unknown>) {
        this.organizations = {
          list: vi.fn().mockRejectedValueOnce(new Error('API down')),
        };
      },
    );

    const result = await fetchTopUpConfig();
    expect(result.packages).toHaveLength(1);
    expect(result.taxBehavior).toBeUndefined();
  });
});
