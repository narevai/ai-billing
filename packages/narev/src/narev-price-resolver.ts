import { createNarevClient } from './narev-client.js';
import type { NarevClientOptions } from './narev-client.js';
import type {
  NarevPricing,
  ModelPricing,
  PriceResolver,
} from '@ai-billing/types';

/**
 * Converts a Narev API pricing object to the billing `ModelPricing` format.
 */
export function narevPricingToModelPricing(p: NarevPricing): ModelPricing {
  return {
    promptTokens: p.prompt,
    completionTokens: p.completion,
    request: p.request || undefined,
    inputCacheReadTokens: p.input_cache_read || undefined,
    inputCacheWriteTokens: p.input_cache_write || undefined,
    internalReasoningTokens: p.internal_reasoning || undefined,
    discount: p.discount || undefined,
  };
}

/**
 * Creates a {@link PriceResolver} backed by the Narev pricing API.
 */
export function createNarevPriceResolver(
  options: NarevClientOptions,
): PriceResolver {
  const client = createNarevClient(options);

  return async ({ modelId, providerId }) => {
    let result;
    try {
      result = await client.listPrices({
        model_id: modelId,
        provider_id: providerId,
      });
    } catch {
      return undefined;
    }

    const entry = result.data.find(e => e.model_id === modelId);
    if (!entry?.pricing) return undefined;

    return narevPricingToModelPricing(entry.pricing);
  };
}
