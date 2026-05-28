'use server';

import { getNarevClient } from '../narev-client.js';
import type { ListModelPricingRequest } from '@ai-billing/narev';
import type { Model, ListModelsMeta } from '@ai-billing/ui';

export interface ModelPricingResult {
  models: Model[];
  meta: ListModelsMeta;
}

/**
 * Fetches paginated model pricing data from the Narev API.
 *
 * @param options - Optional filters and pagination parameters.
 * @returns List of models with pricing and pagination metadata.
 */
export async function fetchModelPricing(
  options?: ListModelPricingRequest,
): Promise<ModelPricingResult> {
  try {
    const client = getNarevClient();
    const response = await client.listModelPricing(options);
    return {
      models: response.data as Model[],
      meta: response.meta,
    };
  } catch (error) {
    console.error('fetchModelPricing: fetch failed', error);
    return {
      models: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    };
  }
}
