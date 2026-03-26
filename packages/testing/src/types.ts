export interface BillingData<TMetadata = Record<string, unknown>> {
  amount: number;
  generationId: string;
  modelId: string;
  provider: string;

  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;

  metadata?: TMetadata;
}

/**
 * A plugin destination that receives the final billing data.
 * It can be async or sync.
 */
export type BillingDestination<TMetadata = Record<string, unknown>> = (
  data: BillingData<TMetadata>,
) => Promise<void> | void;

/**
 * The configuration object passed into any provider's middleware factory.
 */
export interface BillingDestinationConfig {
  destinations?: BillingDestination[];
}

export interface TokenPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/**
 * A plugin that returns the pricing for a specific model.
 */
export type PricingResolver = (
  modelId: string,
  provider: string, // 🚀 ADDED: Required for provider-specific pricing
) => Promise<TokenPricing | null> | TokenPricing | null;
