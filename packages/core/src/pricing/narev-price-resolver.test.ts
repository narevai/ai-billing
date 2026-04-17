import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNarevPriceResolver } from './narev-price-resolver.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
  };
}

describe('createNarevPriceResolver', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return ModelPricing for a matching model', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [
            {
              provider_name: 'OpenAI',
              price_prompt: 5e-6,
              price_completion: 15e-6,
            },
          ],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toEqual({
      promptTokens: 5e-6,
      completionTokens: 15e-6,
    });
  });

  it('should pass providerId as provider query param', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [{ price_prompt: 1e-6, price_completion: 2e-6 }],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: '' });
    await resolver({ modelId: 'gpt-4o', providerId: 'openai' });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('provider=openai');
  });

  it('should pass subProvider as subprovider query param', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [{ price_prompt: 1e-6, price_completion: 2e-6 }],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: '' });
    await resolver({
      modelId: 'gpt-4o',
      providerId: 'openrouter',
      subProvider: 'OpenAI',
    });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('provider=openrouter');
    expect(calledUrl).toContain('subprovider=OpenAI');
  });

  it('should map optional fields when present', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'claude-3-5-sonnet',
          prices: [
            {
              price_prompt: 3e-6,
              price_completion: 15e-6,
              price_request: 0.001,
              price_input_cache_read: 0.3e-6,
              price_input_cache_write: 3.75e-6,
              price_internal_reasoning: 15e-6,
              pricing_discount: 0.5,
            },
          ],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'test-key' });
    const result = await resolver({ modelId: 'claude-3-5-sonnet' });

    expect(result).toEqual({
      promptTokens: 3e-6,
      completionTokens: 15e-6,
      request: 0.001,
      inputCacheReadTokens: 0.3e-6,
      inputCacheWriteTokens: 3.75e-6,
      internalReasoningTokens: 15e-6,
      discount: 0.5,
    });
  });

  it('should send Authorization header when apiKey is provided', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [{ price_prompt: 1e-6, price_completion: 2e-6 }],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'my-secret' });
    await resolver({ modelId: 'gpt-4o' });

    const calledHeaders = mockFetch.mock.calls[0]![1].headers as Record<
      string,
      string
    >;
    expect(calledHeaders['Authorization']).toBe('Bearer my-secret');
  });

  it('should not send Authorization header when apiKey is empty', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [{ price_prompt: 1e-6, price_completion: 2e-6 }],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: '' });
    await resolver({ modelId: 'gpt-4o' });

    const calledHeaders = mockFetch.mock.calls[0]![1].headers as Record<
      string,
      string
    >;
    expect(calledHeaders['Authorization']).toBeUndefined();
  });

  it('should return undefined when response body is null', async () => {
    mockFetch.mockResolvedValue(mockResponse(null));

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toBeUndefined();
  });

  it('should return undefined when model is not in response', async () => {
    mockFetch.mockResolvedValue(mockResponse([]));

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'unknown-model' });

    expect(result).toBeUndefined();
  });

  it('should return undefined on non-ok response', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, false));

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toBeUndefined();
  });

  it('should return undefined on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toBeUndefined();
  });

  it('should return undefined when res.json() throws', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('invalid json');
      },
    });

    const resolver = createNarevPriceResolver({ apiKey: '' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toBeUndefined();
  });

  it('should use custom apiUrl', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          model_id: 'gpt-4o',
          prices: [{ price_prompt: 1e-6, price_completion: 2e-6 }],
        },
      ]),
    );

    const resolver = createNarevPriceResolver({
      apiKey: '',
      apiUrl: 'https://staging.narev.ai',
    });
    await resolver({ modelId: 'gpt-4o' });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('https://staging.narev.ai');
  });
});
