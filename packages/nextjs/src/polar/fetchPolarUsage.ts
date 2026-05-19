'use server';

import { getNarevClient } from '../narev-client.js';
import type { PolarUsageData } from './types.js';

/**
 * Fetches usage data for a given user via the Narev API.
 * @param userId - the end-user ID
 */
export async function fetchPolarUsage(userId: string): Promise<PolarUsageData> {
  const empty = {
    consumedUnits: 0,
    creditedUnits: 0,
    meterName: 'Usage',
    found: false,
  };

  try {
    const client = getNarevClient();
    const response = await client.getBalance(userId);
    const data = response.data;

    return {
      consumedUnits: data.unitsConsumed,
      creditedUnits: data.unitsCredited ?? 0,
      meterName: data.meterName,
      found: data.found,
    };
  } catch (error) {
    console.error('fetchPolarUsage:', error);
  }

  return empty;
}
