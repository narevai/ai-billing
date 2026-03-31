import { describe, it, expect, vi } from 'vitest';
import { createBasePriceResolver } from './base-price-resolver.js';
import type { PriceResolverContext, ModelPricing } from '../types/index.js';

describe('createBasePriceResolver', () => {
  const mockContext: PriceResolverContext = {
    modelId: 'gpt-5',
    providerId: 'openai',
  };

  const mockPricing: ModelPricing = {
    promptTokens: 0.05,
    completionTokens: 0.1,
  };

  it('should successfully wrap a synchronous handler', async () => {
    const syncHandler = vi.fn().mockReturnValue(mockPricing);
    const resolver = createBasePriceResolver(syncHandler);
    const result = await resolver(mockContext);

    // Assertions
    expect(syncHandler).toHaveBeenCalledWith(mockContext);
    expect(syncHandler).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockPricing);
  });

  // 3. Test the asynchronous behavior
  it('should successfully wrap an asynchronous handler', async () => {
    const asyncHandler = vi.fn().mockResolvedValue(mockPricing);

    const resolver = createBasePriceResolver(asyncHandler);
    const result = await resolver(mockContext);

    expect(asyncHandler).toHaveBeenCalledWith(mockContext);
    expect(result).toEqual(mockPricing);
  });

  it('should return undefined if the handler cannot find the price', async () => {
    const notFoundHandler = vi.fn().mockReturnValue(undefined);
    const resolver = createBasePriceResolver(notFoundHandler);
    const result = await resolver(mockContext);

    expect(result).toBeUndefined();
  });
});
