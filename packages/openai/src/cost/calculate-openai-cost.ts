import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost } from '@ai-billing/core';

/** Token usage counts extracted from an OpenAI API response. */
export interface OpenAICostInputs {
  /** Number of prompt (input) tokens. */
  promptTokens: number;
  /** Number of completion (output) tokens. */
  completionTokens: number;
  /** Number of tokens served from the prompt cache. */
  cacheReadTokens: number;
  /** Number of tokens written to the prompt cache. */
  cacheWriteTokens: number;
  /** Number of internal reasoning tokens (o-series models). */
  reasoningTokens: number;
}

/**
 * Calculates the total cost of an OpenAI API call from token usage and model pricing.
 *
 * @param params - Inputs required to calculate the request cost.
 * @returns The calculated {@link Cost}, or `undefined` when `pricing` is not provided.
 * @internal
 */
export const calculateOpenAICost = (params: {
  pricing: ModelPricing | undefined;
  usage: OpenAICostInputs;
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
