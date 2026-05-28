import { describe, it, expect, vi, beforeEach } from 'vitest';
import ky from 'ky';
import { createNarevClient, NarevApiError } from './narev-client.js';
import type {
  BalanceResponse,
  CreditConfigResponse,
  CheckoutResponse,
} from './types.js';

vi.mock('ky', () => ({
  default: { create: vi.fn() },
  isHTTPError: vi.fn(),
}));

const mockKy = vi.mocked(ky);

const mockGet = vi.fn();
const mockPost = vi.fn();

function makeJsonResponse<T>(data: T) {
  return { json: () => Promise.resolve(data) };
}

function makeErrorHook(message: string, status: number) {
  return () => Promise.reject(new NarevApiError(message, status));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockKy.create.mockReturnValue({ get: mockGet, post: mockPost } as never);
});

describe('NarevClient', () => {
  describe('createNarevClient', () => {
    it('passes apiKey as Authorization header and default baseUrl to ky.create', () => {
      createNarevClient({ apiKey: 'test-key' });
      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.narev.ai',
          headers: { Authorization: 'Bearer test-key' },
        }),
      );
    });

    it('passes custom baseUrl to ky.create when provided', () => {
      createNarevClient({ apiKey: 'test-key', baseUrl: 'https://staging.narev.ai' });
      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: 'https://staging.narev.ai' }),
      );
    });
  });

  describe('getBalance', () => {
    it('calls GET v1/balance with userId searchParam', async () => {
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
      mockGet.mockReturnValue(makeJsonResponse(balance));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getBalance({ userId: 'user_123' });

      expect(mockGet).toHaveBeenCalledWith('v1/balance', {
        searchParams: { userId: 'user_123' },
      });
      expect(result).toEqual(balance);
    });

    it('calls GET v1/balance with stripeCustomerId searchParam', async () => {
      const balance: BalanceResponse = {
        data: {
          unitsBalance: null,
          unitsConsumed: 5,
          unitsCredited: null,
          unit: 'nanos',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      };
      mockGet.mockReturnValue(makeJsonResponse(balance));

      const client = createNarevClient({ apiKey: 'test-key' });
      await client.getBalance({ stripeCustomerId: 'cus_abc' });

      expect(mockGet).toHaveBeenCalledWith('v1/balance', {
        searchParams: { stripeCustomerId: 'cus_abc' },
      });
    });

    it('propagates NarevApiError thrown by ky', async () => {
      mockGet.mockReturnValue({ json: makeErrorHook('User not found', 404) });

      const client = createNarevClient({ apiKey: 'test-key' });

      await expect(client.getBalance({ userId: 'unknown' })).rejects.toThrow(NarevApiError);
      await expect(client.getBalance({ userId: 'unknown' })).rejects.toThrow('User not found');
    });
  });

  describe('getCreditConfig', () => {
    it('calls GET v1/credit', async () => {
      const config: CreditConfigResponse = {
        data: {
          packages: [
            { id: 'prod_1', credits: 100, priceCents: 1000 },
            { id: 'prod_2', credits: 500, priceCents: 4500 },
          ],
          taxBehavior: 'exclusive',
        },
      };
      mockGet.mockReturnValue(makeJsonResponse(config));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.getCreditConfig();

      expect(mockGet).toHaveBeenCalledWith('v1/credit');
      expect(result).toEqual(config);
    });
  });

  describe('createCheckout', () => {
    it('calls POST v1/credit with json body', async () => {
      const response: CheckoutResponse = {
        data: { url: 'https://polar.sh/checkout/sess_abc' },
      };
      mockPost.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.createCheckout({
        productId: 'prod_1',
        userId: 'user_123',
        successUrl: 'https://myapp.com/success',
      });

      expect(mockPost).toHaveBeenCalledWith('v1/credit', {
        json: {
          productId: 'prod_1',
          userId: 'user_123',
          successUrl: 'https://myapp.com/success',
        },
      });
      expect(result).toEqual(response);
    });
  });

  describe('error handling', () => {
    it('includes status code in NarevApiError', async () => {
      mockGet.mockReturnValue({ json: makeErrorHook('Forbidden', 401) });

      const client = createNarevClient({ apiKey: 'invalid-key' });

      try {
        await client.getBalance({ userId: 'user_1' });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NarevApiError);
        expect((error as NarevApiError).status).toBe(401);
        expect((error as NarevApiError).message).toBe('Forbidden');
      }
    });
  });
});
