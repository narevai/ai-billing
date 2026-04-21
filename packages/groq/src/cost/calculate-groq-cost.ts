import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost } from '@ai-billing/core';

/**
 * Token usage passed into {@link calculateGroqCost}.
 *
 * Buckets are treated as mutually exclusive (each token count is billed once). The Groq billing middleware
 * derives these from Groq's raw usage payload (`prompt_tokens`, cache details, completion, reasoning).
 */
export interface GroqCostInputs {
  /** Non-cached prompt (input) tokens. */
  promptTokens: number;
  /** Completion tokens excluding reasoning. */
  completionTokens: number;
  /** Tokens served from the prompt cache. */
  cacheReadTokens: number;
  /** Tokens written to the prompt cache. */
  cacheWriteTokens: number;
  /**
   * Reasoning tokens (billed at `internalReasoningTokens` when set on {@link ModelPricing}, otherwise at the
   * completion rate).
   */
  reasoningTokens: number;
  /** Number of web search calls (each billed at `pricing.webSearch` when set). */
  webSearchCount?: number;
}

/**
 * Computes total cost for a Groq completion from {@link ModelPricing} and token usage.
 *
 * Sums independently priced buckets (prompt, cache read, completion, reasoning, cache write) plus an optional
 * per-request fee, then applies `pricing.discount`. Cache-read tokens use `inputCacheReadTokens` when
 * provided; otherwise the rate defaults to half of the prompt rate per token. Cache-write tokens use
 * `inputCacheWriteTokens` when provided; otherwise the rate is zero (free writes).
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link GroqCostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateGroqCost = (params: {
  pricing: ModelPricing | undefined;
  usage: GroqCostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  // Pure multiplication because the buckets are mutually exclusive
  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    usage.promptTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens ?? pricing.promptTokens * 0.5),
    usage.cacheReadTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    usage.completionTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? pricing.completionTokens),
    usage.reasoningTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens ?? 0),
    usage.cacheWriteTokens,
  );

  const requestCost = rateToCost(pricing.request);

  const webSearchCost = multiplyCost(
    rateToCost(pricing.webSearch),
    usage.webSearchCount ?? 0,
  );

  const grossCost = addCosts(
    promptCost,
    completionCost,
    cacheReadCost,
    cacheWriteCost,
    reasoningCost,
    requestCost,
    webSearchCost,
  );

  return applyDiscount(grossCost, pricing.discount ?? 0);
};
