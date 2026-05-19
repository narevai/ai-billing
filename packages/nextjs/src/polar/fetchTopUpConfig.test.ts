import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../narev-client.js', () => ({
  getNarevClient: vi.fn(),
}));

import { getNarevClient } from '../narev-client.js';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NAREV_API_KEY = 'test-key';
});

describe('fetchTopUpConfig', () => {
  it('returns packages and tax behavior from Narev', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getCreditConfig: vi.fn().mockResolvedValueOnce({
        data: {
          packages: [
            { id: 'pkg_1', credits: 100, priceCents: 1000 },
            { id: 'pkg_2', credits: 500, priceCents: 4500 },
          ],
          taxBehavior: 'inclusive',
        },
      }),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchTopUpConfig();
    expect(result.packages).toEqual([
      { id: 'pkg_1', credits: 100, priceCents: 1000 },
      { id: 'pkg_2', credits: 500, priceCents: 4500 },
    ]);
    expect(result.taxBehavior).toBe('inclusive');
  });

  it('returns empty packages when no packages available', async () => {
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getCreditConfig: vi.fn().mockResolvedValueOnce({
        data: { packages: [] },
      }),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchTopUpConfig();
    expect(result.packages).toEqual([]);
    expect(result.taxBehavior).toBeUndefined();
  });

  it('returns empty config when Narev API throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(getNarevClient).mockReturnValueOnce({
      getCreditConfig: vi.fn().mockRejectedValueOnce(new Error('API down')),
    } as ReturnType<typeof getNarevClient>);

    const result = await fetchTopUpConfig();
    expect(result).toEqual({ packages: [] });
    consoleError.mockRestore();
  });
});
