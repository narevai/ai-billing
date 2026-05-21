/** End-user balance and consumption data. */
export interface BalanceData {
  /** Current credit balance (null if not available). */
  unitsBalance: number | null;
  /** Units consumed in the current billing period. */
  unitsConsumed: number;
  /** Total units credited (null for Stripe). */
  unitsCredited: number | null;
  /** Unit of measurement — "base" for Polar, "nanos" for Stripe. */
  unit: 'base' | 'nanos';
  /** Currency code (e.g. "USD"). */
  currency: string;
  /** Display name of the meter. */
  meterName: string;
  /** Whether the end-user has a meter entry. */
  found: boolean;
}

/** Response wrapper for balance data. */
export interface BalanceResponse {
  data: BalanceData;
}

/** A purchasable credit package for top-up. */
export interface CreditPackage {
  /** Product identifier. */
  id: string;
  /** Number of credits included. */
  credits: number;
  /** Price in cents (USD). */
  priceCents: number;
}

/** Credit packages and optional tax behavior configuration. */
export interface CreditConfigData {
  /** Available credit packages. */
  packages: CreditPackage[];
  /** Tax behavior — inclusive, exclusive, or location-based. */
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
}

/** Response wrapper for credit config. */
export interface CreditConfigResponse {
  data: CreditConfigData;
}

/** Identifies an end-user by either their app-level ID or Stripe customer ID. */
export type BalanceLookup = { userId: string } | { stripeCustomerId: string };

/** Request body for creating a checkout session. */
export interface CreateCheckoutRequest {
  /** Credit package product ID. */
  productId: string;
  /** Your end-user's ID. */
  userId: string;
  /** URL to redirect the user after a successful purchase. */
  successUrl: string;
}

/** Response from the checkout creation endpoint. */
export interface CheckoutResponse {
  data: {
    /** URL to redirect the user for payment. */
    url: string;
  };
}

/** Models available per provider. Keys are provider slugs (e.g. "openai"), values are model ID arrays. */
export type ProviderModelsData = Record<string, string[]>;

/** Response wrapper for provider models. */
export interface ProviderModelsResponse {
  data: ProviderModelsData;
}

/** Options for filtering models by provider. */
export interface GetProviderModelsOptions {
  /** Comma-separated list of providers to include (e.g. "openai,anthropic"). Omit to return all. */
  providers?: string;
}
