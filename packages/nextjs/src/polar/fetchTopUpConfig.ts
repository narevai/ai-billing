'use server';

import {
  MOCK_CREDIT_PACKAGES,
  MOCK_TAX_BEHAVIOR,
} from '../mock-billing-data.js';
import type { CreditPackage } from './types.js';

interface TopUpConfig {
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
}

/**
 * Returns mock top-up packages and tax behavior.
 *
 * The Narev credit config endpoint (`GET /v1/credit`) this action used to
 * call no longer exists. Until a replacement backend is available this
 * returns deterministic mock data instead of making a network call.
 */
export async function fetchTopUpConfig(): Promise<TopUpConfig> {
  return {
    packages: MOCK_CREDIT_PACKAGES,
    taxBehavior: MOCK_TAX_BEHAVIOR,
  };
}
