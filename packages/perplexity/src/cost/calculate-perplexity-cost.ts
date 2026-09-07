import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for a Perplexity completion from {@link ModelPricing} and token usage.
 *
 * Simplifications and conventions this calculator makes, and why:
 * - **No prompt caching.** Perplexity does not offer a prompt-caching feature today, so
 *   `cacheReadTokens`/`cacheWriteTokens` are always `0` for this provider (the middleware hardcodes them).
 *   `inputCacheReadTokens`/`inputCacheWriteTokens` pricing and the corresponding cost terms are still wired
 *   through below for interface parity with every other provider's calculator (harmless: `0 × rate = 0`),
 *   in case Perplexity adds caching in the future.
 * - **Reasoning tokens fall back to the completion rate.** Perplexity's reasoning models (`sonar-reasoning`,
 *   `sonar-reasoning-pro`, `sonar-deep-research`) report `reasoning_tokens` separately from
 *   `completion_tokens` and bill them via a distinct `reasoning_tokens_cost`. When `pricing` doesn't set
 *   `internalReasoningTokens`, this calculator falls back to `pricing.completionTokens` (not `0`), so a
 *   customer who hasn't configured a reasoning rate doesn't silently under-bill reasoning output.
 * - **`pricing.request` models Perplexity's flat per-request search fee (`request_cost`).** In reality,
 *   Perplexity's request fee varies by model *and* by `search_context_size` (low/medium/high) — see the
 *   `search_context_size` field on {@link PerplexityV3UsageAccounting}. `ModelPricing.request` has no
 *   `search_context_size` dimension, so this calculator applies a single flat rate per resolved model, the
 *   same simplification every other "flat request fee" provider in this package makes. The flat fee is
 *   added exactly once per request — it is never multiplied by token or search counts. Callers who vary
 *   `search_context_size` per request can approximate tiered pricing by resolving a distinct `modelId` per
 *   tier in their `priceResolver`.
 * - **`pricing.webSearch` is defensive/informational, not Perplexity's real billing driver.** Perplexity
 *   does not charge per citation; its request fee is flat regardless of how many sources came back.
 *   `webSearchCount` (the number of `source` content parts / citations) is still threaded through for
 *   interface parity and analytics, and is only billed when a caller explicitly sets `pricing.webSearch`
 *   (defaults to `$0`, i.e. no cost).
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculatePerplexityCost = (params: {
  pricing: ModelPricing | undefined;
  usage: CostInputs;
}): Cost | undefined => {
  const { pricing, usage } = params;

  if (!pricing) {
    return undefined;
  }

  const reasoningTokens = usage.reasoningTokens ?? 0;

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
    reasoningTokens,
  );

  // Flat per-request search fee (Perplexity's `request_cost`); added exactly once, never multiplied by any
  // token or search count.
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
