import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for a Z.ai (GLM) completion from {@link ModelPricing} and token usage.
 *
 * Cache-read tokens use `inputCacheReadTokens` when provided; otherwise defaults to half the prompt rate.
 * Cache-write tokens use `inputCacheWriteTokens` when provided; otherwise zero (free writes).
 * Reasoning tokens are not billed separately and do not affect this calculation at all — GLM's
 * `completion_tokens_details.reasoning_tokens` is already a subset of `completion_tokens`, and Z.ai does
 * not publish a distinct reasoning-token rate. `usage.completionTokens` is billed in full at the
 * completion rate regardless of `usage.reasoningTokens`.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateZaiCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  const cacheReadTokens = usage.cacheReadTokens ?? 0;

  const basePromptTokens = Math.max(0, usage.promptTokens - cacheReadTokens);

  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    basePromptTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens),
    cacheReadTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    usage.completionTokens,
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
    requestCost,
    webSearchCost,
  );

  return applyDiscount(grossCost, pricing.discount ?? 0);
};
