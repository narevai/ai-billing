import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { fetchStripeConfig } = await import('./fetchStripeConfig.js');

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchStripeConfig', () => {
  it('returns config when Narev responds 200', async () => {
    process.env.NAREV_API_KEY = 'sk_test';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { meterId: 'mtr_stripe' } }),
    });

    const result = await fetchStripeConfig();
    expect(result).toEqual({ meterId: 'mtr_stripe' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.narev.ai/api/billing-target/stripe',
      { headers: { Authorization: 'Bearer sk_test' } },
    );
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await fetchStripeConfig();
    expect(result).toBeNull();
  });
});
