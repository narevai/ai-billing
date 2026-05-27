import type {
  BalanceLookup,
  BalanceResponse,
  CheckoutResponse,
  CreateCheckoutRequest,
  CreditConfigResponse,
  GetProviderModelsOptions,
  ListModelsPricingOptions,
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
  getBalance(lookup: BalanceLookup): Promise<BalanceResponse>;

  /** Fetches available credit packages for top-up. */
  getCreditConfig(): Promise<CreditConfigResponse>;

  /**
   * Creates a checkout session for an end-user to purchase credits.
   * @param request - checkout details (product, user, success URL)
   */
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutResponse>;

  /**
   * Returns all available models grouped by provider.
   * @param options - optional filter by provider slugs
   */
  getProviderModels(
    options?: GetProviderModelsOptions,
  ): Promise<ProviderModelsResponse>;

  /**
   * Returns a paginated list of models with pricing details.
   * @param options - optional filters, sorting and pagination
   */
  listModelsPricing(
    options?: ListModelsPricingOptions,
  ): Promise<ListModelsResponse>;
}

class NarevClientImpl implements NarevClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: NarevClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async getBalance(lookup: BalanceLookup): Promise<BalanceResponse> {
    const url = new URL('/v1/balance', this.baseUrl);
    if ('stripeCustomerId' in lookup) {
      url.searchParams.set('stripeCustomerId', lookup.stripeCustomerId);
    } else {
      url.searchParams.set('userId', lookup.userId);
    }
    return this.request<BalanceResponse>(url);
  }

  async getCreditConfig(): Promise<CreditConfigResponse> {
    const url = new URL('/v1/credit', this.baseUrl);

    return this.request<CreditConfigResponse>(url);
  }

  async createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<CheckoutResponse> {
    const url = new URL('/v1/credit', this.baseUrl);

    return this.request<CheckoutResponse>(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getProviderModels(
    options?: GetProviderModelsOptions,
  ): Promise<ProviderModelsResponse> {
    const url = new URL('/v1/provider-models', this.baseUrl);
    if (options?.providers) {
      url.searchParams.set('providers', options.providers);
    }
    return this.request<ProviderModelsResponse>(url);
  }

  async listModelsPricing(
    options?: ListModelsPricingOptions,
  ): Promise<ListModelsResponse> {
    const url = new URL('/v1/models/pricing', this.baseUrl);
    if (options) {
      const {
        model_id,
        search,
        provider,
        subprovider,
        sort_by,
        order,
        page,
        limit,
      } = options;
      if (model_id !== undefined) url.searchParams.set('model_id', model_id);
      if (search !== undefined) url.searchParams.set('search', search);
      if (provider !== undefined) url.searchParams.set('provider', provider);
      if (subprovider !== undefined)
        url.searchParams.set('subprovider', subprovider);
      if (sort_by !== undefined) url.searchParams.set('sort_by', sort_by);
      if (order !== undefined) url.searchParams.set('order', order);
      if (page !== undefined) url.searchParams.set('page', String(page));
      if (limit !== undefined) url.searchParams.set('limit', String(limit));
    }
    return this.request<ListModelsResponse>(url);
  }

  private async request<T>(
    url: URL,
    init?: Omit<RequestInit, 'headers'> & {
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    };

    const response = await fetch(url.toString(), {
      ...init,
      headers,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      const errorMessage =
        (body as { error?: string })?.error ??
        `Narev API returned ${response.status} ${response.statusText}`;
      throw new NarevApiError(errorMessage, response.status, body);
    }

    return body as T;
  }
}

/**
 * Creates a new Narev API client.
 * @param options - client configuration (API key, optional base URL)
 * @returns a typed {@link NarevClient} instance
 */
export function createNarevClient(options: NarevClientOptions): NarevClient {
  return new NarevClientImpl(options);
}
