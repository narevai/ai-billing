import { createBasePriceResolver } from './base-price-resolver.js';
import type { ModelPricing, PriceResolverContext } from '../types/index.js';

type PricingRow = Record<string, number | string>;
type PricingMap = Record<string, PricingRow[]>;

function rowToModelPricing(row: PricingRow): ModelPricing {
  return {
    promptTokens: row['price_prompt'] as number,
    completionTokens: row['price_completion'] as number,
    ...(row['price_request'] != null && {
      request: row['price_request'] as number,
    }),
    ...(row['price_input_cache_read'] != null && {
      inputCacheReadTokens: row['price_input_cache_read'] as number,
    }),
    ...(row['price_input_cache_write'] != null && {
      inputCacheWriteTokens: row['price_input_cache_write'] as number,
    }),
    ...(row['price_internal_reasoning'] != null && {
      internalReasoningTokens: row['price_internal_reasoning'] as number,
    }),
    ...(row['pricing_discount'] != null && {
      discount: row['pricing_discount'] as number,
    }),
  };
}

export type NarevPriceResolverOptions = {
  apiKey: string;
  apiUrl?: string;
};

export function createNarevPriceResolver({
  apiKey,
  apiUrl = 'https://narev.ai',
}: NarevPriceResolverOptions): ReturnType<typeof createBasePriceResolver> {
  return createBasePriceResolver(
    async ({
      modelId,
      providerId,
      subProvider,
    }: PriceResolverContext): Promise<ModelPricing | undefined> => {
      const params = new URLSearchParams({ model_id: modelId });
      if (providerId) params.set('gateway', providerId);
      if (subProvider) params.set('provider', subProvider);

      const url = `${apiUrl}/api/models/pricing?${params}`;
      const headers: Record<string, string> = apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : {};

      let data: PricingMap | null;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) return undefined;
        data = (await res.json()) as PricingMap | null;
      } catch {
        return undefined;
      }

      if (!data) return undefined;

      const rows = data[modelId];
      const row = rows?.[0];
      if (!row) return undefined;

      return rowToModelPricing(row);
    },
  );
}
