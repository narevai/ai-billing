import type {
  GetBalanceRequest,
  BalanceResponse,
  CheckoutResponse,
  CreateCheckoutRequest,
  CreditConfigResponse,
  ListModelsRequest,
  ModelsResponse,
  ListPricesRequest,
  PriceResponse,
  SearchPricesRequest,
  ProvidersResponse,
  TraceCostRequest,
  TraceCostResponse,
} from '@ai-billing/types';

/** Options for creating a Narev API client. */
export interface NarevClientOptions {
  /** Narev API key (bearer token). */
  apiKey: string;
  /** Base URL override (defaults to https://api.narev.ai). */
  baseUrl?: string;
}

/**
 * Typed client for the Narev billing API.
 *
 * Covers balance checks, top-up/credit operations, model/provider reference,
 * pricing lookups, and cost calculation.
 */
export interface NarevClient {
  /**
   * Fetches the end-user's balance and consumption for the current billing period.
   * Pass either `{ userId }` or `{ stripeCustomerId }`.
   */
  getBalance(request: GetBalanceRequest): Promise<BalanceResponse>;

  /** Fetches available credit packages for top-up. */
  getCreditConfig(): Promise<CreditConfigResponse>;

  /** Creates a checkout session for an end-user to purchase credits. */
  createCheckout(_request: CreateCheckoutRequest): Promise<CheckoutResponse>;

  /** Returns a paginated list of model references (provider_id + model_id, no pricing). */
  listModels(_request?: ListModelsRequest): Promise<ModelsResponse>;

  /** Returns all supported providers with their display name. */
  listProviders(): Promise<ProvidersResponse>;

  /** Returns a paginated list of pricing entries filtered by provider and/or model. */
  listPrices(_request?: ListPricesRequest): Promise<PriceResponse>;

  /** Searches pricing entries by model ID (full-text search via `q`). */
  searchPrices(_request?: SearchPricesRequest): Promise<PriceResponse>;

  /** Calculates the cost for a model call given token usage. */
  calculateCost(request: TraceCostRequest): Promise<TraceCostResponse>;
}

/** Error thrown when the Narev API returns a non-2xx response. */
export class NarevApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code returned by the API. */
    public status: number,
    /** Raw response body, if parsing succeeded. */
    public body?: unknown,
  ) {
    super(message);
    this.name = 'NarevApiError';
  }
}

/**
 * Creates a new Narev API client.
 * @param options - client configuration (API key, optional base URL)
 * @returns a typed {@link NarevClient} instance
 */
export function createNarevClient(_options: NarevClientOptions): NarevClient {
  return {
    async getBalance(request: GetBalanceRequest): Promise<BalanceResponse> {
      const isStripe = 'stripeCustomerId' in request;
      return {
        data: {
          unitsBalance: isStripe ? null : 1000000000,
          unitsConsumed: 1000,
          unitsCredited: isStripe ? null : 1000000000,
          unit: isStripe ? 'nanos' : 'base',
          currency: 'USD',
          meterName: 'Usage',
          found: true,
        },
      };
    },

    async getCreditConfig(): Promise<CreditConfigResponse> {
      return {
        data: {
          packages: [
            { id: 'prod_1', credits: 100, priceCents: 1000 },
            { id: 'prod_2', credits: 500, priceCents: 4500 },
          ],
          taxBehavior: 'exclusive',
        },
      };
    },

    async createCheckout(
      _request: CreateCheckoutRequest,
    ): Promise<CheckoutResponse> {
      return {
        data: { url: 'https://mock.checkout.url/sess_mock' },
      };
    },

    async listModels(_request?: ListModelsRequest): Promise<ModelsResponse> {
      return {
        data: [
          { provider_id: 'openai', model_id: 'gpt-4o' },
          { provider_id: 'anthropic', model_id: 'claude-3-5-haiku-latest' },
        ],
        meta: { page: 1, page_size: 100, total: 2, total_pages: 1 },
      };
    },

    async listProviders(): Promise<ProvidersResponse> {
      return {
        data: [
          { provider_id: 'openai', name: 'OpenAI' },
          { provider_id: 'anthropic', name: 'Anthropic' },
        ],
      };
    },

    async listPrices(_request?: ListPricesRequest): Promise<PriceResponse> {
      return {
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      };
    },

    async searchPrices(_request?: SearchPricesRequest): Promise<PriceResponse> {
      return {
        data: [],
        meta: { page: 1, page_size: 100, total: 0, total_pages: 0 },
      };
    },

    async calculateCost(request: TraceCostRequest): Promise<TraceCostResponse> {
      return {
        model_id: request.model_id,
        provider_id: request.provider_id,
        usage: request.usage,
        pricing: {
          prompt: 0,
          completion: 0,
          discount: 0,
          request: 0,
          web_search: 0,
          input_cache_read: 0,
          input_cache_write: 0,
          image: 0,
          image_output: 0,
          audio: 0,
          audio_output: 0,
          input_audio_cache: 0,
          internal_reasoning: 0,
        },
        cost_breakdown: { total: 0 },
      };
    },
  };
}
