/** A purchasable credit package for top-up. */
export interface CreditPackage {
  /** Product identifier. */
  id: string;
  /** Number of credits included. */
  credits: number;
  /** Price in cents (USD). */
  priceCents: number;
}

/** Pricing fields for a single model (new API format, no price_/pricing_ prefixes). */
export interface NarevPricing {
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

/** A single pricing entry with provider and model info (ModelPricingItem in openapi). */
export interface ModelPricingItem {
  model_id: string;
  provider_id: string;
  pricing: NarevPricing | null;
  message?: string;
}

/** Pagination metadata returned with list responses. */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** Response wrapper for the pricing list. */
export interface PriceResponse {
  data: ModelPricingItem[];
  meta: PaginationMeta;
}

/** A model reference entry (provider_id + model_id, no pricing). */
export interface ModelRef {
  provider_id: string;
  model_id: string;
}

/** Response wrapper for the models reference list. */
export interface ModelsResponse {
  data: ModelRef[];
  meta: PaginationMeta;
}

/** A provider reference entry. */
export interface ProviderRef {
  provider_id: string;
  name: string;
}

/** Response wrapper for the providers reference list. */
export interface ProvidersResponse {
  data: ProviderRef[];
}

/** Options for filtering and paginating the pricing list (GET /v1/prices). */
export interface ListPricesRequest {
  provider_id?: string;
  model_id?: string;
  sort_by?: 'model_id' | 'provider_id';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

/** Options for searching pricing by model ID (GET /v1/prices/search). */
export interface SearchPricesRequest {
  /** Full-text search query matched against model ID. */
  q?: string;
  provider_id?: string;
  model_id?: string;
  sort_by?: 'model_id' | 'provider_id';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

/** Options for filtering the models reference list (GET /v1/reference/models). */
export interface ListModelsRequest {
  /** Comma-separated list of provider IDs to filter by. */
  provider_id?: string;
  page?: number;
  page_size?: number;
}

/** Token usage for a cost calculation request. */
export interface TraceCostUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
  web_search_count?: number;
}

/** Request body for POST /v1/traces/cost. */
export interface TraceCostRequest {
  model_id: string;
  provider_id: string;
  usage: TraceCostUsage;
}

/** Response from POST /v1/traces/cost. */
export interface TraceCostResponse {
  model_id: string;
  provider_id: string;
  usage: TraceCostUsage;
  pricing: NarevPricing;
  cost_breakdown: { total: number };
}
