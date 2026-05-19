'use server';

import { getNarevClient } from '../narev-client.js';
import type { CreditPackage } from './types.js';

interface TopUpConfig {
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
}

/** Fetches available top-up packages and optional tax behavior from Narev. */
export async function fetchTopUpConfig(): Promise<TopUpConfig> {
  const config: TopUpConfig = { packages: [] };

  try {
    const client = getNarevClient();
    const response = await client.getCreditConfig();
    const data = response.data;

    config.packages = data.packages;

    if (data.taxBehavior) {
      config.taxBehavior = data.taxBehavior;
    }
  } catch (error) {
    console.error('fetchTopUpConfig: config fetch failed', error);
  }

  return config;
}
