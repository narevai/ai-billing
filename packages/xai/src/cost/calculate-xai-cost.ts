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

  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const reasoningTokens = usage.reasoningTokens ?? 0;

  const basePromptTokens = Math.max(
    0,
    usage.promptTokens - usage.cacheReadTokens,
  );

  const baseCompletionTokens = Math.max(
    0,
    usage.completionTokens - reasoningTokens,
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
    rateToCost(pricing.completionTokens),
    reasoningTokens,
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
    reasoningCost,
    requestCost,
    webSearchCost,
  );

  return applyDiscount(grossCost, pricing.discount ?? 0);
};
