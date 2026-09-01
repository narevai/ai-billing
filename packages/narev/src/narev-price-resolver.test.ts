import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createNarevPriceResolver,
  narevPricingToModelPricing,
} from './narev-price-resolver.js';
import * as narevClient from './narev-client.js';
import type { NarevPricing, PriceResponse } from '@ai-billing/types';

vi.mock('./narev-client.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./narev-client.js')>();
  return {
    ...actual,
    createNarevClient: vi.fn(),
  };
});

const mockListPrices = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(narevClient.createNarevClient).mockReturnValue({
    listPrices: mockListPrices,
  } as unknown as ReturnType<typeof narevClient.createNarevClient>);
});

function makeResponse(
  entries: { model_id: string; pricing: Partial<NarevPricing> | null }[],
): PriceResponse {
  const zeroPricing: NarevPricing = {
    prompt: 0,
    completion: 0,
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
  };
  return {
    data: entries.map(e => ({
      provider_id: 'openai',
      model_id: e.model_id,
      pricing: e.pricing ? { ...zeroPricing, ...e.pricing } : null,
    })),
    meta: { page: 1, page_size: 10, total: entries.length, total_pages: 1 },
  };
}

describe('narevPricingToModelPricing', () => {
  it('maps required fields', () => {
    const input: NarevPricing = {
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
    };
    expect(narevPricingToModelPricing(input)).toEqual({
      promptTokens: 5e-6,
      completionTokens: 15e-6,
    });
  });

  it('maps optional fields when non-zero', () => {
    const input: NarevPricing = {
      prompt: 3e-6,
      completion: 15e-6,
      discount: 0.5,
      request: 0.001,
      web_search: 0,
      input_cache_read: 0.3e-6,
      input_cache_write: 3.75e-6,
      image: 0,
      image_output: 0,
      audio: 0,
      audio_output: 0,
      input_audio_cache: 0,
      internal_reasoning: 15e-6,
    };
    expect(narevPricingToModelPricing(input)).toEqual({
      promptTokens: 3e-6,
      completionTokens: 15e-6,
      request: 0.001,
      inputCacheReadTokens: 0.3e-6,
      inputCacheWriteTokens: 3.75e-6,
      internalReasoningTokens: 15e-6,
      discount: 0.5,
    });
  });
});

describe('createNarevPriceResolver', () => {
  it('returns ModelPricing for a matching model', async () => {
    mockListPrices.mockResolvedValue(
      makeResponse([
        {
          model_id: 'gpt-4o',
          pricing: { prompt: 5e-6, completion: 15e-6 },
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'test-key' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toEqual({ promptTokens: 5e-6, completionTokens: 15e-6 });
  });

  it('passes model_id and provider_id to listPrices', async () => {
    mockListPrices.mockResolvedValue(
      makeResponse([
        {
          model_id: 'gpt-4o',
          pricing: { prompt: 1e-6, completion: 2e-6 },
        },
      ]),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    await resolver({
      modelId: 'gpt-4o',
      providerId: 'openai',
      subProvider: 'azure',
    });

    expect(mockListPrices).toHaveBeenCalledWith({
      model_id: 'gpt-4o',
      provider_id: 'openai',
    });
  });

  it('returns undefined when model not in response', async () => {
    mockListPrices.mockResolvedValue(makeResponse([]));

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'unknown' })).toBeUndefined();
  });

  it('returns undefined when pricing is null', async () => {
    mockListPrices.mockResolvedValue(
      makeResponse([{ model_id: 'gpt-4o', pricing: null }]),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'gpt-4o' })).toBeUndefined();
  });

  it('returns undefined on error', async () => {
    mockListPrices.mockRejectedValue(new Error('network'));

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'gpt-4o' })).toBeUndefined();
  });
});
