'use server';

import type { PolarUsageData } from './types.js';

/**
 * Fetches usage data for a given user. (Mocked implementation)
 * @param _userId - the end-user ID
 */
export async function fetchPolarUsage(
  _userId: string,
): Promise<PolarUsageData> {
  return {
    consumedUnits: 12.5,
    creditedUnits: 50.0,
    meterName: 'Tokens',
    found: true,
  };
}
