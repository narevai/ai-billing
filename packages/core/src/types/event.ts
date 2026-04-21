import type { Cost, DefaultTags } from './index.js';

export interface Usage {
  readonly subProvider?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly requestCount?: number;
  readonly webSearchCount?: number;
  readonly rawProviderCost?: number;
  readonly rawUpstreamInferenceCost?: number;
}

export interface BillingEvent<TTags extends DefaultTags = DefaultTags> {
  readonly generationId: string;
  readonly modelId: string;
  readonly provider: string;
  readonly usage: Usage;
  readonly cost?: Cost;
  readonly tags: TTags;
}

export type EventBuilder<TPayload, TTags extends DefaultTags = DefaultTags> = (
  payload: TPayload,
) => Promise<BillingEvent<TTags> | null> | BillingEvent<TTags> | null;
