import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for a Cohere completion from {@link ModelPricing} and token usage.
 *
 * Unlike Mistral/DeepSeek/xAI, Cohere's `promptTokens`/`completionTokens` (see the Cohere billing
 * middleware) are already fed from the provider's `billed_units` — the tokens Cohere actually charges
 * for — not a raw total that includes cache hits. Cohere's `cached_tokens` counter does not reconcile
 * with `billed_units` by subtraction, and Cohere does not publish a discounted cached-input rate. So,
 * unlike the Mistral-style calculators, this function does **not** subtract cache/reasoning tokens from
 * the prompt/completion totals before billing them — it bills `promptTokens`/`completionTokens` as-is
 * (mirroring `calculateOpenAICost`'s purely additive shape) and treats cache-read, cache-write, and
 * reasoning tokens as optional, zero-by-default additive line items that only contribute cost when a
 * caller explicitly sets `inputCacheReadTokens`, `inputCacheWriteTokens`, or `internalReasoningTokens` in
 * the resolved {@link ModelPricing}.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateCohereCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
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
    rateToCost(pricing.inputCacheReadTokens ?? 0),
    usage.cacheReadTokens ?? 0,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens ?? 0),
    usage.cacheWriteTokens ?? 0,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? 0),
    usage.reasoningTokens ?? 0,
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
