'use server';

import { Polar } from '@polar-sh/sdk';
import { fetchPolarConfig } from './fetchPolarConfig.js';
import type { CreditPackage } from './types.js';

interface TopUpConfig {
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
}

/** Fetches available top-up packages and optional tax behavior from Polar */
export async function fetchTopUpConfig(): Promise<TopUpConfig> {
  const config: TopUpConfig = { packages: [] };

  try {
    const polarConfig = await fetchPolarConfig();
    if (!polarConfig) return config;

    config.packages = polarConfig.topup ?? [];

    const env = polarConfig.environment ?? 'sandbox';
    try {
      const polar = new Polar({
        accessToken: process.env.POLAR_ACCESS_TOKEN,
        server: env,
      });
      const orgs = await polar.organizations.list({ limit: 1 });
      const org = orgs.result?.items?.[0];
      const tb = org?.defaultTaxBehavior;
      if (tb === 'inclusive' || tb === 'exclusive' || tb === 'location') {
        config.taxBehavior = tb as typeof config.taxBehavior;
      }
    } catch {
      /* no tax */
    }
  } catch {
    /* no config */
  }

  return config;
}
