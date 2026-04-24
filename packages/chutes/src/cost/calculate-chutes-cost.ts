import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/core';

/**
 * Computes total cost for a Chutes completion from {@link ModelPricing} and token usage.
 *
 * Cache-read tokens use `inputCacheReadTokens` when provided; otherwise defaults to half the prompt rate.
 * Cache-write tokens use `inputCacheWriteTokens` when provided; otherwise zero (free writes).
 * Reasoning tokens use `internalReasoningTokens` when provided; otherwise completion rate.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateChutesCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  const nonCachedPromptTokens = Math.max(
    0,
    usage.promptTokens - usage.cacheReadTokens,
  );

  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    nonCachedPromptTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens ?? 0),
    usage.cacheReadTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    usage.completionTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? 0),
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
