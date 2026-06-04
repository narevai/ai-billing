import { createNarevClient } from './narev-client.js';
import type { NarevClientOptions } from './narev-client.js';
import type {
  NarevModelPricing,
  ModelPricing,
  PriceResolver,
} from '@ai-billing/types';

/**
 * Converts a Narev API model pricing object to the billing `ModelPricing` format.
 *
 * @param p - The Narev model pricing object.
 */
export function narevModelPricingToModelPricing(
  p: NarevModelPricing,
): ModelPricing {
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
 *
 * @param options - Narev client options including the API key.
 */
export function createNarevPriceResolver(
  options: NarevClientOptions,
): PriceResolver {
  const client = createNarevClient(options);

  return async ({ modelId, providerId }) => {
    let result;
    try {
      result = await client.listModelPricing({
        model_id: modelId,
        provider: providerId,
      });
    } catch {
      return undefined;
    }

    const entry = result.data.find(e => e.model_id === modelId);
    if (!entry?.pricing) return undefined;

    return narevModelPricingToModelPricing(entry.pricing);
  };
}
