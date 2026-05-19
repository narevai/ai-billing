'use server';

import type { BalanceLookup } from '@ai-billing/narev';
import { getNarevClient } from '../narev-client.js';
import type { StripeUsageData } from './types.js';

/** Fetches usage data for a given customer via the Narev API. */
export async function fetchStripeUsage(
  lookup: BalanceLookup,
): Promise<StripeUsageData> {
  const empty = { aggregatedValue: 0, found: false };

  try {
    const client = getNarevClient();
    const response = await client.getBalance(lookup);
    const data = response.data;

    const aggregatedValue =
      data.unit === 'nanos'
        ? data.unitsConsumed / 1_000_000_000
        : data.unitsConsumed;

    return {
      aggregatedValue,
      found: data.found,
    };
  } catch (error) {
    console.error('fetchStripeUsage:', error);
  }

  return empty;
}
