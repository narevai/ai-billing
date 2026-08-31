import type { CreditPackage } from '@ai-billing/types';
import type { PolarUsageData } from './polar/types.js';
import type { StripeUsageData } from './stripe/types.js';

/**
 * Temporary mock fixtures for the nextjs billing UI server actions.
 *
 * The Narev endpoints these actions used to call (`GET /v1/balance` and
 * `GET`/`POST /v1/credit`) no longer exist. Until a replacement backend is
 * available, `fetchPolarUsage`, `fetchStripeUsage`, `fetchTopUpConfig`, and
 * `createCheckout` return deterministic mock data derived from these
 * fixtures instead of calling `getNarevClient`.
 */

/** Mock usage data returned by {@link fetchPolarUsage}. */
export const MOCK_POLAR_USAGE_DATA: PolarUsageData = {
  consumedUnits: 42,
  creditedUnits: 100,
  meterName: 'Usage',
  found: true,
};

/** Mock usage data returned by {@link fetchStripeUsage}. */
export const MOCK_STRIPE_USAGE_DATA: StripeUsageData = {
  aggregatedValue: 12.5,
  found: true,
};

/** Mock credit packages returned by {@link fetchTopUpConfig}. */
export const MOCK_CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg_small', credits: 100, priceCents: 500 },
  { id: 'pkg_medium', credits: 500, priceCents: 2000 },
  { id: 'pkg_large', credits: 1000, priceCents: 3500 },
];

/** Mock tax behavior returned alongside {@link MOCK_CREDIT_PACKAGES}. */
export const MOCK_TAX_BEHAVIOR = 'exclusive' as const;
