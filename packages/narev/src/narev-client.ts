import ky, { isHTTPError } from 'ky';
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
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutResponse>;

  /** Returns a paginated list of model references (provider_id + model_id, no pricing). */
  listModels(request?: ListModelsRequest): Promise<ModelsResponse>;

  /** Returns all supported providers with their display name. */
  listProviders(): Promise<ProvidersResponse>;

  /** Returns a paginated list of pricing entries filtered by provider and/or model. */
  listPrices(request?: ListPricesRequest): Promise<PriceResponse>;

  /** Searches pricing entries by model ID (full-text search via `q`). */
  searchPrices(request?: SearchPricesRequest): Promise<PriceResponse>;

  /** Calculates the cost for a model call given token usage. */
  calculateCost(request: TraceCostRequest): Promise<TraceCostResponse>;
}

const DEFAULT_BASE_URL = 'https://api.narev.ai';

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
export function createNarevClient(options: NarevClientOptions): NarevClient {
  const { apiKey, baseUrl = DEFAULT_BASE_URL } = options;

  const api = ky.create({
    baseUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
    retry: { limit: 2 },
    hooks: {
      beforeError: [
        async ({ error }) => {
          if (!isHTTPError(error)) return error;
          const body = (await error.response.json().catch(() => undefined)) as
            | { error?: string }
            | undefined;
          const message =
            body?.error ??
            `Narev API returned ${error.response.status} ${error.response.statusText}`;
          return new NarevApiError(message, error.response.status, body);
        },
      ],
    },
  });

  return {
    getBalance(request: GetBalanceRequest): Promise<BalanceResponse> {
      const searchParams =
        'stripeCustomerId' in request
          ? { stripeCustomerId: request.stripeCustomerId }
          : { userId: request.userId };
      return api.get('v1/balance', { searchParams }).json<BalanceResponse>();
    },

    getCreditConfig(): Promise<CreditConfigResponse> {
      return api.get('v1/credit').json<CreditConfigResponse>();
    },

    createCheckout(request: CreateCheckoutRequest): Promise<CheckoutResponse> {
      return api.post('v1/credit', { json: request }).json<CheckoutResponse>();
    },

    listModels(request?: ListModelsRequest): Promise<ModelsResponse> {
      const searchParams: Record<string, string | number> = {};
      if (request) {
        if (request.provider_id !== undefined)
          searchParams['provider_id'] = request.provider_id;
        if (request.page !== undefined) searchParams['page'] = request.page;
        if (request.page_size !== undefined)
          searchParams['page_size'] = request.page_size;
      }
      return api
        .get('v1/reference/models', { searchParams })
        .json<ModelsResponse>();
    },

    listProviders(): Promise<ProvidersResponse> {
      return api.get('v1/reference/providers').json<ProvidersResponse>();
    },

    listPrices(request?: ListPricesRequest): Promise<PriceResponse> {
      const searchParams: Record<string, string | number> = {};
      if (request) {
        if (request.provider_id !== undefined)
          searchParams['provider_id'] = request.provider_id;
        if (request.model_id !== undefined)
          searchParams['model_id'] = request.model_id;
        if (request.sort_by !== undefined)
          searchParams['sort_by'] = request.sort_by;
        if (request.order !== undefined) searchParams['order'] = request.order;
        if (request.page !== undefined) searchParams['page'] = request.page;
        if (request.page_size !== undefined)
          searchParams['page_size'] = request.page_size;
      }
      return api.get('v1/prices', { searchParams }).json<PriceResponse>();
    },

    searchPrices(request?: SearchPricesRequest): Promise<PriceResponse> {
      const searchParams: Record<string, string | number> = {};
      if (request) {
        if (request.q !== undefined) searchParams['q'] = request.q;
        if (request.provider_id !== undefined)
          searchParams['provider_id'] = request.provider_id;
        if (request.model_id !== undefined)
          searchParams['model_id'] = request.model_id;
        if (request.sort_by !== undefined)
          searchParams['sort_by'] = request.sort_by;
        if (request.order !== undefined) searchParams['order'] = request.order;
        if (request.page !== undefined) searchParams['page'] = request.page;
        if (request.page_size !== undefined)
          searchParams['page_size'] = request.page_size;
      }
      return api
        .get('v1/prices/search', { searchParams })
        .json<PriceResponse>();
    },

    calculateCost(request: TraceCostRequest): Promise<TraceCostResponse> {
      return api
        .post('v1/traces/cost', { json: request })
        .json<TraceCostResponse>();
    },
  };
}
