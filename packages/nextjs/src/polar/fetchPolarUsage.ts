'use server';

import { Polar } from '@polar-sh/sdk';
import { fetchPolarConfig } from './fetchPolarConfig.js';
import type { PolarUsageData } from './types.js';

/**
 * Fetches usage data from Polar for a given customer meter.
 * @param userId - the external customer ID in Polar
 */
export async function fetchPolarUsage(userId: string): Promise<PolarUsageData> {
  const empty = {
    consumedUnits: 0,
    creditedUnits: 0,
    meterName: 'Usage',
    found: false,
  };

  const config = await fetchPolarConfig();
  if (!config || !config.meterId) return empty;

  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: config.environment,
  });

  try {
    const page = await polar.customerMeters.list({
      externalCustomerId: userId,
      meterId: config.meterId,
      limit: 1,
    });
    const item = page.result.items[0];
    if (item) {
      return {
        consumedUnits: item.consumedUnits,
        creditedUnits: item.creditedUnits,
        meterName: item.meter.name,
        found: true,
      };
    }
  } catch (error) {
    console.error('fetchPolarUsage:', error);
  }

  return empty;
}
