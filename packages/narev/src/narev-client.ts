import ky, { isHTTPError } from 'ky';
import type {
  GetBalanceRequest,
  BalanceResponse,
  CheckoutResponse,
  CreateCheckoutRequest,
  CreditConfigResponse,
  GetProviderModelsRequest,
  ListModelPricingRequest,
  ListModelsResponse,
  ProviderModelsResponse,
} from './types.js';

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

/** Options for creating a Narev API client. */
export interface NarevClientOptions {
  /** Narev API key (bearer token). */
  apiKey: string;
  /** Base URL override (defaults to {@link DEFAULT_BASE_URL}). */
  baseUrl?: string;
}

/**
 * Typed client for the Narev billing API.
 *
 * Covers balance checks and top-up/credit operations.
 */
export interface NarevClient {
  /**
   * Fetches the end-user's balance and consumption for the current billing period.
   * Pass either `{ userId }` or `{ stripeCustomerId }`.
   */
  getBalance(request: GetBalanceRequest): Promise<BalanceResponse>;

  /** Fetches available credit packages for top-up. */
  getCreditConfig(): Promise<CreditConfigResponse>;

  /**
   * Creates a checkout session for an end-user to purchase credits.
   */
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutResponse>;

  /**
   * Returns all available models grouped by provider.
   */
  getProviderModels(
    request?: GetProviderModelsRequest,
  ): Promise<ProviderModelsResponse>;

  /**
   * Returns a paginated list of models with pricing details.
   */
  listModelPricing(
    request?: ListModelPricingRequest,
  ): Promise<ListModelsResponse>;
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

    getProviderModels(
      request?: GetProviderModelsRequest,
    ): Promise<ProviderModelsResponse> {
      const searchParams = request?.providers
        ? { providers: request.providers }
        : undefined;
      return api
        .get('v1/provider-models', { searchParams })
        .json<ProviderModelsResponse>();
    },

    listModelPricing(
      request?: ListModelPricingRequest,
    ): Promise<ListModelsResponse> {
      const searchParams: Record<string, string | number> = {};
      if (request) {
        const {
          model_id,
          search,
          provider,
          subprovider,
          sort_by,
          order,
          page,
          limit,
        } = request;
        if (model_id !== undefined) searchParams['model_id'] = model_id;
        if (search !== undefined) searchParams['search'] = search;
        if (provider !== undefined) searchParams['provider'] = provider;
        if (subprovider !== undefined)
          searchParams['subprovider'] = subprovider;
        if (sort_by !== undefined) searchParams['sort_by'] = sort_by;
        if (order !== undefined) searchParams['order'] = order;
        if (page !== undefined) searchParams['page'] = page;
        if (limit !== undefined) searchParams['limit'] = limit;
      }
      return api
        .get('v1/models/pricing', { searchParams })
        .json<ListModelsResponse>();
    },
  };
}
