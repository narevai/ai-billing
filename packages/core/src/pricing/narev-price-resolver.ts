import { createBasePriceResolver } from './base-price-resolver.js';
import type {
  ModelPricing,
  PriceResolver,
  PriceResolverContext,
} from '../types/index.js';

type PricingData = {
  price_prompt: number;
  price_completion: number;
  pricing_discount: number;
  pricing_request: number;
  price_web_search: number;
  price_input_cache_read: number;
  price_input_cache_write: number;
  price_internal_reasoning: number;
};

type PricingEntry = {
  model_id: string;
  provider: string;
  subprovider: string | null;
  pricing: PricingData | null;
};

type PricingResponse = {
  data: PricingEntry[];
  meta: unknown;
};

function pricingDataToModelPricing(p: PricingData): ModelPricing {
  return {
    promptTokens: p.price_prompt,
    completionTokens: p.price_completion,
    request: p.pricing_request || undefined,
    inputCacheReadTokens: p.price_input_cache_read || undefined,
    inputCacheWriteTokens: p.price_input_cache_write || undefined,
    internalReasoningTokens: p.price_internal_reasoning || undefined,
    discount: p.pricing_discount || undefined,
  };
}

/**
 * Configuration for {@link createNarevPriceResolver}.
 */
export type NarevPriceResolverOptions = {
  /** API key used for authenticated pricing requests. */
  apiKey: string;
  /** Optional base URL for the Narev API. */
  apiUrl?: string;
};

/**
 * Creates a price resolver that fetches model pricing from the Narev API.
 *
 * @param options - Resolver options; see {@link NarevPriceResolverOptions}.
 * @returns A base price resolver that resolves model pricing from Narev.
 */
export function createNarevPriceResolver(
  options: NarevPriceResolverOptions,
): PriceResolver {
  const { apiKey, apiUrl = 'https://narev.ai' } = options;

  return createBasePriceResolver(
    async ({
      modelId,
      providerId,
      subProvider,
    }: PriceResolverContext): Promise<ModelPricing | undefined> => {
      const params = new URLSearchParams({ model_id: modelId });
      if (providerId) params.set('provider', providerId);
      if (subProvider) params.set('subprovider', subProvider);

      const url = `${apiUrl}/api/models/pricing?${params}`;
      const headers: Record<string, string> = apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : {};

      let response: PricingResponse | null;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) return undefined;
        response = (await res.json()) as PricingResponse | null;
      } catch {
        return undefined;
      }

      if (!response) return undefined;

      const entry = response.data.find(e => e.model_id === modelId);
      if (!entry?.pricing) return undefined;

      return pricingDataToModelPricing(entry.pricing);
    },
  );
}
