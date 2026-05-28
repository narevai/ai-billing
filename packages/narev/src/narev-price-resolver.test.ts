import { describe, it, expect, vi, beforeEach } from 'vitest';
import ky from 'ky';
import {
  createNarevPriceResolver,
  narevModelPricingToModelPricing,
} from './narev-price-resolver.js';
import type { NarevModelPricing, ListModelsResponse } from '@ai-billing/types';

vi.mock('ky', () => ({
  default: { create: vi.fn() },
  isHTTPError: vi.fn(),
}));

const mockKy = vi.mocked(ky);
const mockGet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockKy.create.mockReturnValue({ get: mockGet } as never);
});

function makeJsonResponse<T>(data: T) {
  return { json: () => Promise.resolve(data) };
}

function makeResponse(
  entries: { model_id: string; pricing: Partial<NarevModelPricing> | null }[],
): ListModelsResponse {
  const zeroPricing: NarevModelPricing = {
    price_prompt: 0,
    price_completion: 0,
    pricing_discount: 0,
    pricing_request: 0,
    price_web_search: 0,
    price_input_cache_read: 0,
    price_input_cache_write: 0,
    price_image: 0,
    price_image_output: 0,
    price_audio: 0,
    price_audio_output: 0,
    price_input_audio_cache: 0,
    price_internal_reasoning: 0,
  };
  return {
    data: entries.map(e => ({
      provider: 'openai',
      subprovider: '',
      model_id: e.model_id,
      pricing: e.pricing ? { ...zeroPricing, ...e.pricing } : null,
    })),
    meta: { page: 1, limit: 10, total: entries.length, total_pages: 1 },
  };
}

describe('narevModelPricingToModelPricing', () => {
  it('maps required fields', () => {
    const input: NarevModelPricing = {
      price_prompt: 5e-6,
      price_completion: 15e-6,
      pricing_discount: 0,
      pricing_request: 0,
      price_web_search: 0,
      price_input_cache_read: 0,
      price_input_cache_write: 0,
      price_image: 0,
      price_image_output: 0,
      price_audio: 0,
      price_audio_output: 0,
      price_input_audio_cache: 0,
      price_internal_reasoning: 0,
    };
    expect(narevModelPricingToModelPricing(input)).toEqual({
      promptTokens: 5e-6,
      completionTokens: 15e-6,
    });
  });

  it('maps optional fields when non-zero', () => {
    const input: NarevModelPricing = {
      price_prompt: 3e-6,
      price_completion: 15e-6,
      pricing_discount: 0.5,
      pricing_request: 0.001,
      price_web_search: 0,
      price_input_cache_read: 0.3e-6,
      price_input_cache_write: 3.75e-6,
      price_image: 0,
      price_image_output: 0,
      price_audio: 0,
      price_audio_output: 0,
      price_input_audio_cache: 0,
      price_internal_reasoning: 15e-6,
    };
    expect(narevModelPricingToModelPricing(input)).toEqual({
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
    mockGet.mockReturnValue(
      makeJsonResponse(
        makeResponse([
          {
            model_id: 'gpt-4o',
            pricing: { price_prompt: 5e-6, price_completion: 15e-6 },
          },
        ]),
      ),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'test-key' });
    const result = await resolver({ modelId: 'gpt-4o' });

    expect(result).toEqual({ promptTokens: 5e-6, completionTokens: 15e-6 });
  });

  it('passes model_id, provider, subprovider to listModelPricing', async () => {
    mockGet.mockReturnValue(
      makeJsonResponse(
        makeResponse([
          {
            model_id: 'gpt-4o',
            pricing: { price_prompt: 1e-6, price_completion: 2e-6 },
          },
        ]),
      ),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    await resolver({
      modelId: 'gpt-4o',
      providerId: 'openai',
      subProvider: 'azure',
    });

    expect(mockGet).toHaveBeenCalledWith('v1/models/pricing', {
      searchParams: expect.objectContaining({
        model_id: 'gpt-4o',
        provider: 'openai',
        subprovider: 'azure',
      }),
    });
  });

  it('returns undefined when model not in response', async () => {
    mockGet.mockReturnValue(makeJsonResponse(makeResponse([])));

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'unknown' })).toBeUndefined();
  });

  it('returns undefined when pricing is null', async () => {
    mockGet.mockReturnValue(
      makeJsonResponse(makeResponse([{ model_id: 'gpt-4o', pricing: null }])),
    );

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'gpt-4o' })).toBeUndefined();
  });

  it('returns undefined on error', async () => {
    mockGet.mockReturnValue({
      json: () => Promise.reject(new Error('network')),
    });

    const resolver = createNarevPriceResolver({ apiKey: 'key' });
    expect(await resolver({ modelId: 'gpt-4o' })).toBeUndefined();
  });
});
