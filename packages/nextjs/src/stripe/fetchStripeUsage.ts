'use server';

import type { GetBalanceRequest } from '@ai-billing/types';
import { MOCK_STRIPE_USAGE_DATA } from '../mock-billing-data.js';
import type { StripeUsageData } from './types.js';

/**
 * Returns mock usage data for a given customer.
 *
 * The Narev balance endpoint (`GET /v1/balance`) this action used to call no
 * longer exists. Until a replacement backend is available this returns
 * deterministic mock data instead of making a network call.
 * @param request - User identifier — either `{ userId }` or `{ stripeCustomerId }`.
 */
export async function fetchStripeUsage(
  request: GetBalanceRequest,
): Promise<StripeUsageData> {
  void request;
  return MOCK_STRIPE_USAGE_DATA;
}
