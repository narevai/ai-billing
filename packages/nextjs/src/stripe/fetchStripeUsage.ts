'use server';

import type { StripeUsageData } from './types.js';

/**
 * Fetches usage data for a given customer. (Mocked implementation)
 * @param _request - User identifier — either `{ userId }` or `{ stripeCustomerId }`.
 */
export async function fetchStripeUsage(_request: {
  stripeCustomerId?: string;
  userId?: string;
}): Promise<StripeUsageData> {
  return { aggregatedValue: 12.5, found: true };
}
