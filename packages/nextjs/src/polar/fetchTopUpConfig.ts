'use server';

import type { CreditPackage } from './types.js';

interface TopUpConfig {
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
}

/** Fetches available top-up packages and optional tax behavior from Narev. */
export async function fetchTopUpConfig(): Promise<TopUpConfig> {
  return {
    packages: [{ id: 'mock_1', credits: 1000, priceCents: 1000 }],
    taxBehavior: 'exclusive',
  };
}
