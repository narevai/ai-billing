export type CostUnit = 'base' | 'cents' | 'millicents' | 'microcents';

export interface Cost {
  readonly amount: number;
  readonly currency: string;
  readonly unit: CostUnit;
}

export interface Usage {
  readonly subProviderId?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly requestCount?: number;
  readonly rawProviderCost?: number; // Renamed for clarity
}

export interface BillingEvent<TMetadata = any> {
  readonly generationId: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly usage: Usage;
  readonly cost: Cost;
  readonly metadata: TMetadata;
}
