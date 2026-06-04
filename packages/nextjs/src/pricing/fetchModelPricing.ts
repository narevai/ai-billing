'use server';

import { getNarevClient } from '../narev-client.js';
import type {
  SearchPricesRequest,
  ModelPricingItem,
  PaginationMeta,
} from '@ai-billing/types';

export interface ModelPricingResult {
  models: ModelPricingItem[];
  meta: PaginationMeta;
}

/**
 * Fetches paginated model pricing data from the Narev API.
 * Supports full-text search via `q` and filtering by `provider_id` / `model_id`.
 *
 * @param options - Optional search and pagination parameters.
 * @returns List of pricing entries and pagination metadata.
 */
export async function fetchModelPricing(
  options?: SearchPricesRequest,
): Promise<ModelPricingResult> {
  try {
    const client = getNarevClient();
    const response = await client.searchPrices(options);
    return {
      models: response.data,
      meta: response.meta,
    };
  } catch (error) {
    console.error('fetchModelPricing: fetch failed', error);
    return {
      models: [],
      meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
    };
  }
}
