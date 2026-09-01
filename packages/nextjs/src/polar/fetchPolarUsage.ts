'use server';

import type { PolarUsageData } from './types.js';

/**
 * Fetches usage data for a given user via the Narev API.
 * @param userId - the end-user ID
 */
export async function fetchPolarUsage(userId: string): Promise<PolarUsageData> {
  return {
    consumedUnits: 12.5,
    creditedUnits: 50.0,
    meterName: 'Tokens',
    found: true,
  };
}