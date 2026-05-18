'use server';

import { getNarevClient } from '../narev-client.js';
import type { StripeUsageData } from './types.js';

/**
 * Fetches usage data for a given customer via the Narev API.
 * @param stripeCustomerId - the Stripe customer ID (used as userId for Narev)
 */
export async function fetchStripeUsage(
  stripeCustomerId: string,
): Promise<StripeUsageData> {
  const empty = { aggregatedValue: 0, found: false };

  try {
    const client = getNarevClient();
    const response = await client.getBalance(stripeCustomerId);
    const data = response.data;

    return {
      aggregatedValue: data.unitsConsumed,
      found: data.found,
    };
  } catch (error) {
    console.error('fetchStripeUsage:', error);
  }

  return empty;
}
