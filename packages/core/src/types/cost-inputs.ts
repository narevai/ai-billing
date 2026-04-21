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
