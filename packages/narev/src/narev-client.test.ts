import { describe, it, expect, vi, beforeEach } from 'vitest';
import ky from 'ky';
import { createNarevClient, NarevApiError } from './narev-client.js';
import type {
  ModelsResponse,
  ProvidersResponse,
  PriceResponse,
  TraceCostResponse,
} from '@ai-billing/types';

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
      createNarevClient({
        apiKey: 'test-key',
        baseUrl: 'https://example.com',
      });
      expect(mockKy.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: 'https://example.com' }),
      );
    });
  });

  describe('listModels', () => {
    it('calls GET v1/reference/models without params', async () => {
      const response: ModelsResponse = {
        data: [
          { provider_id: 'openai', model_id: 'gpt-4o' },
          { provider_id: 'anthropic', model_id: 'claude-3-5-haiku-latest' },
        ],
        meta: { page: 1, page_size: 100, total: 2, total_pages: 1 },
      };
      mockGet.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.listModels();

      expect(mockGet).toHaveBeenCalledWith('v1/reference/models', {
        searchParams: {},
      });
      expect(result).toEqual(response);
    });

    it('passes provider_id and page_size as searchParams', async () => {
      mockGet.mockReturnValue(
        makeJsonResponse({
          data: [],
          meta: { page: 1, page_size: 1000, total: 0, total_pages: 0 },
        }),
      );

      const client = createNarevClient({ apiKey: 'test-key' });
      await client.listModels({
        provider_id: 'openai,anthropic',
        page_size: 1000,
      });

      expect(mockGet).toHaveBeenCalledWith('v1/reference/models', {
        searchParams: { provider_id: 'openai,anthropic', page_size: 1000 },
      });
    });
  });

  describe('listProviders', () => {
    it('calls GET v1/reference/providers', async () => {
      const response: ProvidersResponse = {
        data: [
          { provider_id: 'openai', name: 'OpenAI' },
          { provider_id: 'anthropic', name: 'Anthropic' },
        ],
      };
      mockGet.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.listProviders();

      expect(mockGet).toHaveBeenCalledWith('v1/reference/providers');
      expect(result).toEqual(response);
    });
  });

  describe('listPrices', () => {
    it('calls GET v1/prices without params', async () => {
      const response: PriceResponse = {
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      };
      mockGet.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      await client.listPrices();

      expect(mockGet).toHaveBeenCalledWith('v1/prices', { searchParams: {} });
    });

    it('passes provider_id and model_id as searchParams', async () => {
      mockGet.mockReturnValue(
        makeJsonResponse({
          data: [],
          meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
        }),
      );

      const client = createNarevClient({ apiKey: 'test-key' });
      await client.listPrices({ provider_id: 'openai', model_id: 'gpt-4o' });

      expect(mockGet).toHaveBeenCalledWith('v1/prices', {
        searchParams: { provider_id: 'openai', model_id: 'gpt-4o' },
      });
    });
  });

  describe('searchPrices', () => {
    it('calls GET v1/prices/search with q param', async () => {
      const response: PriceResponse = {
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      };
      mockGet.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      await client.searchPrices({ q: 'gpt-4', provider_id: 'openai' });

      expect(mockGet).toHaveBeenCalledWith('v1/prices/search', {
        searchParams: { q: 'gpt-4', provider_id: 'openai' },
      });
    });
  });

  describe('calculateCost', () => {
    it('calls POST v1/traces/cost with json body', async () => {
      const response: TraceCostResponse = {
        model_id: 'gpt-4o',
        provider_id: 'openai',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
        pricing: {
          prompt: 5e-6,
          completion: 15e-6,
          discount: 0,
          request: 0,
          web_search: 0,
          input_cache_read: 0,
          input_cache_write: 0,
          image: 0,
          image_output: 0,
          audio: 0,
          audio_output: 0,
          input_audio_cache: 0,
          internal_reasoning: 0,
        },
        cost_breakdown: { total: 0.0125 },
      };
      mockPost.mockReturnValue(makeJsonResponse(response));

      const client = createNarevClient({ apiKey: 'test-key' });
      const result = await client.calculateCost({
        model_id: 'gpt-4o',
        provider_id: 'openai',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });

      expect(mockPost).toHaveBeenCalledWith('v1/traces/cost', {
        json: {
          model_id: 'gpt-4o',
          provider_id: 'openai',
          usage: { prompt_tokens: 1000, completion_tokens: 500 },
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
        await client.listModels();
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NarevApiError);
        expect((error as NarevApiError).status).toBe(401);
        expect((error as NarevApiError).message).toBe('Forbidden');
      }
    });
  });
});
