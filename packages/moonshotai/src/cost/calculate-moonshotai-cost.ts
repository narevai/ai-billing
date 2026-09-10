import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for a Moonshot AI (Kimi) completion from {@link ModelPricing} and token usage.
 *
 * **Contract: `usage.completionTokens` must be text-only.** This function bills `completionTokens` and
 * `reasoningTokens` *additively* — `completionCost + reasoningCost`, with no subtraction between them.
 * Callers MUST pre-subtract `reasoningTokens` out of the provider's raw `completion_tokens` before
 * calling this function directly, i.e. pass `completionTokens = rawCompletionTokens - reasoningTokens`,
 * exactly as `createMoonshotaiV3Middleware`/`createMoonshotaiV4Middleware` already do. Passing the raw,
 * un-normalized `completion_tokens` total (which already includes reasoning tokens) alongside a nonzero
 * `reasoningTokens` will double-bill those reasoning tokens — this is not a bug, it is this function's
 * documented input contract, and there is a regression test locking in that exact behavior.
 *
 * Cache-read tokens use `inputCacheReadTokens` when provided; otherwise zero (no cache discount applied).
 * Cache-write tokens are always zero — Moonshot AI has no cache-write pricing.
 *
 * Reasoning tokens use `internalReasoningTokens` when provided, otherwise fall back to the
 * `completionTokens` rate (per the documented `CostInputs.reasoningTokens` contract in
 * `@ai-billing/types`). This deliberately differs from `@ai-billing/deepseek`/`@ai-billing/minimax`,
 * which default the reasoning rate to `0` when `internalReasoningTokens` is unset: Kimi K3 always
 * reasons and Moonshot bills reasoning output tokens at the same flat rate as text output tokens, so
 * defaulting to `0` would systematically undercount cost. `completionTokens` passed in here is expected
 * to already be text-only (reasoning tokens excluded), so this addition does not double-count.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}. `usage.completionTokens` must already
 * exclude `usage.reasoningTokens` — see the contract note above.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateMoonshotaiCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const reasoningTokens = usage.reasoningTokens ?? 0;

  const nonCachedPromptTokens = Math.max(
    0,
    usage.promptTokens - cacheReadTokens,
  );

  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    nonCachedPromptTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens ?? 0),
    cacheReadTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens ?? 0),
    cacheWriteTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    usage.completionTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? pricing.completionTokens),
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
    cacheWriteCost,
    reasoningCost,
    requestCost,
    webSearchCost,
  );

  return applyDiscount(grossCost, pricing.discount ?? 0);
};
