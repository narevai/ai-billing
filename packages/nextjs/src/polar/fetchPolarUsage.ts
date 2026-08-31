'use server';

import { MOCK_POLAR_USAGE_DATA } from '../mock-billing-data.js';
import type { PolarUsageData } from './types.js';

/**
 * Returns mock usage data for a given user.
 *
 * The Narev balance endpoint (`GET /v1/balance`) this action used to call no
 * longer exists. Until a replacement backend is available this returns
 * deterministic mock data instead of making a network call.
 * @param userId - the end-user ID
 */
export async function fetchPolarUsage(userId: string): Promise<PolarUsageData> {
  void userId;
  return MOCK_POLAR_USAGE_DATA;
}
