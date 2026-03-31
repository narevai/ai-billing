import { describe, it, expect } from 'vitest';
import { createObjectPriceResolver } from './object-price-resolver.js';
import type { ModelPricing, PriceResolverContext } from '../types/index.js';

describe('createObjectPriceResolver', () => {
  const mockPricingMap: Record<string, ModelPricing> = {
    'gpt-5': {
      promptTokens: 1.25 / 1_000_000,
      completionTokens: 10.0 / 1_000_000,
    },
    'gpt-4o': {
      promptTokens: 5.0 / 1_000_000,
      completionTokens: 15.0 / 1_000_000,
    },
  };

  const mockResolver = createObjectPriceResolver(mockPricingMap);

  it('should return the correct ModelPricing when modelId exists in the map', async () => {
    const mockModelId = 'gpt-5';
    const context: PriceResolverContext = {
      modelId: mockModelId,
    };

    const result = await mockResolver(context);
    expect(result).toEqual(mockPricingMap[mockModelId]);
  });

  it('should handle additional parameters', async () => {
    const mockModelId = 'gpt-5';
    const context: PriceResolverContext = {
      modelId: mockModelId,
      providerId: 'xyz',
      quantization: '8-bit',
    };

    const result = await mockResolver(context);
    expect(result).toEqual(mockPricingMap[mockModelId]);
  });

  it('should return undefined when the modelId is not in the map', async () => {
    const mockModelId = 'some-unknown-model';
    const context: PriceResolverContext = {
      modelId: mockModelId,
    };

    const result = await mockResolver(context);
    expect(result).toBeUndefined();
  });
});
