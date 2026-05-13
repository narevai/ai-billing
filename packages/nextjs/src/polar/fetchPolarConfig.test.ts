import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { fetchPolarConfig } = await import('./fetchPolarConfig.js');

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchPolarConfig', () => {
  it('returns config when Narev responds 200', async () => {
    process.env.NAREV_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { meterId: 'mtr_123', environment: 'sandbox', topup: [] },
      }),
    });

    const result = await fetchPolarConfig();
    expect(result).toEqual({
      meterId: 'mtr_123',
      environment: 'sandbox',
      topup: [],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.narev.ai/api/billing-target/polar',
      { headers: { Authorization: 'Bearer test-key' } },
    );
  });

  it('returns null when Narev responds 401', async () => {
    process.env.NAREV_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchPolarConfig();
    expect(result).toBeNull();
  });

  it('returns null when NAREV_API_KEY is not set', async () => {
    delete process.env.NAREV_API_KEY;

    const result = await fetchPolarConfig();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    process.env.NAREV_API_KEY = 'test-key';
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await fetchPolarConfig();
    expect(result).toBeNull();
  });
});
