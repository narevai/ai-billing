'use server';

import { getNarevClient } from '../narev-client.js';
import type { ListModelsPricingOptions } from '@ai-billing/narev';
import type { Model, ListModelsMeta } from '@ai-billing/ui';

export interface ModelsPricingResult {
  models: Model[];
  meta: ListModelsMeta;
}

export async function fetchModelsPricing(
  options?: ListModelsPricingOptions,
): Promise<ModelsPricingResult> {
  try {
    const client = getNarevClient();
    const response = await client.listModelsPricing(options);
    return {
      models: response.data as Model[],
      meta: response.meta,
    };
  } catch (error) {
    console.error('fetchModelsPricing: fetch failed', error);
    return {
      models: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    };
  }
}
