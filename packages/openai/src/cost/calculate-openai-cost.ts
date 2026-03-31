import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost } from '@ai-billing/core';

export interface OpenAICostInputs {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

export const calculateOpenAICost = ({
  pricing,
  usage,
}: {
  pricing: ModelPricing | undefined;
  usage: OpenAICostInputs;
}): Cost | undefined => {
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
