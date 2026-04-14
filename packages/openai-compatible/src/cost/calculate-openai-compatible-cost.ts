import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost } from '@ai-billing/core';

export interface OpenAICompatibleCostInputs {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

/**
 * Calculates the total cost of an OpenAI-compatible API call from token usage and model pricing.
 *
 * @param params - Inputs required to calculate the request cost.
 * - `params.pricing`: Per-token rates for the model, or `undefined` if pricing is unavailable.
 * - `params.usage`: Token counts from the API response.
 * @returns The calculated {@link Cost}, or `undefined` when `pricing` is not provided.
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
