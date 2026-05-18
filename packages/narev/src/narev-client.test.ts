import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNarevClient, NarevApiError } from './narev-client.js';
import type {
  BalanceResponse,
  CreditConfigResponse,
  CheckoutResponse,
} from './types.js';

const mockFetch = vi.fn<typeof fetch>();

vi.stubGlobal('fetch', mockFetch);

function mockResponse<T>(body: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response;
}

describe('NarevClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should fetch balance with correct URL and auth', async () => {
      const balance: BalanceResponse = {
        data: {
          unitsBalance: 50,
          unitsConsumed: 10,
          unitsCredited: 100,
          unit: 'base',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      };

      mockFetch.mockResolvedValueOnce(mockResponse(balance));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getBalance('user_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.narev.ai/v1/balance?userId=user_123',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(balance);
    });

    it('should throw NarevApiError on non-200 response', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({ error: 'User not found' }, 404),
      );

      const client = createNarevClient({ apiKey: 'test-key' });

      await expect(client.getBalance('unknown')).rejects.toThrow(NarevApiError);
      await expect(client.getBalance('unknown')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('getCreditConfig', () => {
    it('should fetch credit config', async () => {
      const config: CreditConfigResponse = {
        data: {
          packages: [
            { id: 'prod_1', credits: 100, priceCents: 1000 },
            { id: 'prod_2', credits: 500, priceCents: 4500 },
          ],
          taxBehavior: 'exclusive',
        },
      };

      mockFetch.mockResolvedValueOnce(mockResponse(config));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getCreditConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.narev.ai/v1/credit',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(config);
    });
  });

  describe('createCheckout', () => {
    it('should create checkout and return URL', async () => {
      const response: CheckoutResponse = {
        data: { url: 'https://polar.sh/checkout/sess_abc' },
      };

      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.createCheckout({
        productId: 'prod_1',
        userId: 'user_123',
        successUrl: 'https://myapp.com/success',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.narev.ai/v1/credit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            productId: 'prod_1',
            userId: 'user_123',
            successUrl: 'https://myapp.com/success',
          }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(response);
    });
  });

  describe('custom baseUrl', () => {
    it('should use custom baseUrl when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            unitsBalance: 0,
            unitsConsumed: 0,
            unitsCredited: 0,
            unit: 'base',
            currency: 'USD',
            meterName: 'Usage',
            found: false,
          },
        }),
      );

      const client = createNarevClient({
        apiKey: 'test-key',
        baseUrl: 'https://staging.narev.ai/v1',
      });
      await client.getBalance('user_1');

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('https://staging.narev.ai');
    });
  });

  describe('error handling', () => {
    it('should include status code in NarevApiError', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: 'Forbidden' }, 401),
      );

      const client = createNarevClient({ apiKey: 'invalid-key' });

      try {
        await client.getBalance('user_1');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NarevApiError);
        expect((error as NarevApiError).status).toBe(401);
        expect((error as NarevApiError).message).toBe('Forbidden');
      }
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      const client = createNarevClient({ apiKey: 'test-key' });

      await expect(client.getBalance('user_1')).rejects.toThrow(NarevApiError);
    });
  });
});
