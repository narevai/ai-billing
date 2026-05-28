import type { JSONObject } from '@ai-sdk/provider';

export type CostUnit = 'base' | 'cents' | 'micros' | 'nanos';

export interface Cost {
  readonly amount: number;
  readonly currency: string;
  readonly unit: CostUnit;
}

/**
 * Token usage passed into a provider cost calculation function.
 */
export interface CostInputs {
  /** Number of prompt (input) tokens. */
  promptTokens: number;
  /** Number of completion (output) tokens. */
  completionTokens: number;
  /** Number of tokens served from the prompt cache. */
  cacheReadTokens: number;
  /** Number of tokens written to the prompt cache. */
  cacheWriteTokens: number;
  /**
   * Number of reasoning tokens (priced with `internalReasoningTokens` when present in `ModelPricing`,
   * otherwise at the completion rate).
   */
  reasoningTokens: number;
  /** Number of web search calls (each billed at `pricing.webSearch` when set). */
  webSearchCount?: number;
}

export interface ModelPricing {
  promptTokens: number;
  completionTokens: number;
  inputCacheReadTokens?: number;
  inputCacheWriteTokens?: number;
  internalReasoningTokens?: number;
  request?: number;
  webSearch?: number;
  discount?: number;
}

export type PriceResolverContext = {
  modelId: string;
  providerId?: string;
  subProvider?: string;
  quantization?: string;
};

export type PriceResolver = (
  context: PriceResolverContext,
) => Promise<ModelPricing | undefined>;

export type DefaultTags = JSONObject;

export interface Usage {
  readonly subProvider?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
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

export type Destination<TTags extends DefaultTags = DefaultTags> = (
  event: BillingEvent<TTags>,
) => Promise<void> | void;

export interface BaseBillingMiddlewareOptions<
  TTags extends JSONObject = DefaultTags,
> {
  /** One or more billing destinations that receive each emitted {@link BillingEvent}. */
  destinations?: Destination<TTags>[];
  /** Tags merged into every emitted event. */
  defaultTags?: TTags;
  /**
   * Edge-runtime hook (e.g. `ctx.waitUntil`) used to keep the process alive
   * while billing events are flushed asynchronously.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Called when an error occurs during event extraction or dispatch. Defaults to a silent no-op. */
  onError?: (error: unknown) => void;
}

export interface MeterMetadata {
  generation_id: string;
  model_id: string;
  provider: string;
  sub_provider?: string;

  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  request_count?: number;
  web_search_count?: number;
  raw_provider_cost?: number;
  raw_upstream_inference_cost?: number;

  [key: string]: string | number | undefined;
}
