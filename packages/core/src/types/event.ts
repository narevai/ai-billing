export type CostUnit =
  | 'base' // e.g., 1 = $1.00 (Standard dollars/euros. Usually avoided to prevent float math, but good for flat-rate models)
  | 'cents' // e.g., 100 = $1.00 (The Stripe standard)
  | 'millicents' // e.g., 100,000 = $1.00 (1/1,000 of a cent. Common in ad-tech and cloud billing)
  | 'microcents'; // e.g., 100,000,000 = $1.00 (1/1,000,000 of a cent. Perfect for per-token LLM pricing)

export interface Cost {
  /**
   * The integer amount.
   * To avoid float math, this should represent the smallest unit defined below.
   * e.g., 1500
   */
  readonly amount: number;

  /**
   * The ISO 4217 currency code.
   * e.g., 'USD'
   */
  readonly currency: string;

  /**
   * The scale of the integer. For LLMs, cents aren't small enough.
   * e.g., 'microcents' (1/1,000,000 of a cent) or 'millicents'
   */
  readonly unit: CostUnit;
}

export interface Usage {
  readonly subProviderId?: string; // For cases where a provider has multiple sub-services (e.g., Azure's OpenAI vs. other Azure services)

  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly requestCount?: number;

  readonly costReported?: number;
}

export interface BaseEvent {
  readonly generationId: string;
  readonly modelId: string;
  readonly providerId: string;
}

export interface UsageEvent extends BaseEvent {
  readonly usage: Usage;
}

export interface BillingEvent extends UsageEvent {
  readonly cost: Cost;
}
