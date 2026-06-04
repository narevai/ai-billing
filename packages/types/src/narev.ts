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
export type GetBalanceRequest =
  | { userId: string }
  | { stripeCustomerId: string };

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
export interface GetProviderModelsRequest {
  /** Comma-separated list of providers to include (e.g. "openai,anthropic"). Omit to return all. */
  providers?: string;
}

/** Pricing details for a single model (raw Narev API format). */
export interface NarevModelPricing {
  prompt: number;
  completion: number;
  discount: number;
  request: number;
  web_search: number;
  input_cache_read: number;
  input_cache_write: number;
  image: number;
  image_output: number;
  audio: number;
  audio_output: number;
  input_audio_cache: number;
  internal_reasoning: number;
}

/** A single model entry with provider and pricing info. */
export interface Model {
  model_id: string;
  provider_id: string;
  subprovider: string | null;
  pricing: NarevModelPricing | null;
  message?: string;
}

/** Pagination metadata returned with model list responses. */
export interface ListModelsMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/** Response wrapper for the model list. */
export interface ListModelsResponse {
  data: Model[];
  meta: ListModelsMeta;
}

/** Options for filtering and paginating the model pricing list. */
export interface ListModelPricingRequest {
  /** Filter by exact model ID. */
  model_id?: string;
  /** Full-text search across model IDs. */
  search?: string;
  /** Filter by provider slug (e.g. "openai"). */
  provider?: string;
  /** Filter by subprovider name. */
  subprovider?: string;
  /** Field to sort by. */
  sort_by?: string;
  /** Sort order ("asc" or "desc"). */
  order?: 'asc' | 'desc';
  /** Page number (1-based). */
  page?: number;
  /** Number of results per page. */
  limit?: number;
}
