import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost } from '@ai-billing/core';

/**
 * Token usage passed into {@link calculateOpenAICompatibleCost}.
 *
 * Counts follow the same meaning as an OpenAI-style completion: prompt vs completion, cache read/write, and
 * reasoning. The OpenAI-compatible billing middleware maps AI SDK `usage` into this shape.
 */
export interface OpenAICompatibleCostInputs {
  /** Number of prompt (input) tokens. */
  promptTokens: number;
  /** Number of completion (output) tokens. */
  completionTokens: number;
  /** Number of tokens served from the prompt cache. */
  cacheReadTokens: number;
  /** Number of tokens written to the prompt cache. */
  cacheWriteTokens: number;
  /** Number of reasoning tokens (priced with `internalReasoningTokens` when present in {@link ModelPricing}). */
  reasoningTokens: number;
}

/**
 * Computes total cost for an OpenAI-compatible completion from {@link ModelPricing} and token usage.
 *
 * Builds line items for prompt, completion, cache read, cache write, and reasoning (using `internalReasoningTokens` when defined on {@link ModelPricing}, otherwise the completion rate), adds an
 * optional per-request fee when `pricing.request` is set, then applies `pricing.discount`. Same pricing model
 * as `@ai-billing/openai`, for usage normalized by `@ai-sdk/openai-compatible`.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link OpenAICompatibleCostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateOpenAICompatibleCost = (params: {
  pricing: ModelPricing | undefined;
  usage: OpenAICompatibleCostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    usage.promptTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    usage.completionTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens),
    usage.cacheReadTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens),
    usage.cacheWriteTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? pricing.completionTokens),
    usage.reasoningTokens,
  );

  const requestCost = rateToCost(pricing.request);

  const grossCost = addCosts(
    promptCost,
    completionCost,
    cacheReadCost,
    cacheWriteCost,
    reasoningCost,
    requestCost,
  );

  return applyDiscount(grossCost, pricing.discount ?? 0);
};
