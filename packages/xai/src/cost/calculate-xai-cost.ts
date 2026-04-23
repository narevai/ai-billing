import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/core';

/**
 * Computes total cost for an xAI completion from {@link ModelPricing} and token usage.
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
export const calculateXaiCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  // xAI returns inclusive token totals. We must subtract subsets to prevent double-billing.
  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const reasoningTokens = usage.reasoningTokens ?? 0;

  const basePromptTokens = Math.max(
    0,
    (usage.promptTokens ?? 0) - cacheReadTokens - cacheWriteTokens,
  );
  const baseCompletionTokens = Math.max(
    0,
    (usage.completionTokens ?? 0) - reasoningTokens,
  );

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
    baseCompletionTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens),
    reasoningTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens),
    cacheWriteTokens,
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
