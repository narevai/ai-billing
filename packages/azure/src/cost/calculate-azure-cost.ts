import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for an Azure (AI Foundry) completion from {@link ModelPricing} and token usage.
 *
 * This sandbox's Azure is Azure AI Foundry (`*.services.ai.azure.com`), routed through the Responses API
 * (`provider: "azure.responses"`), which reuses `@ai-sdk/openai`'s Responses-API implementation under the
 * hood. Its raw `usage.input_tokens` / `usage.output_tokens` are each a **total** that includes their
 * respective subsets: `input_tokens_details.{cached_tokens,cache_write_tokens}` are subsets of
 * `input_tokens`, and `output_tokens_details.reasoning_tokens` is a subset of `output_tokens` (the same
 * "total includes subset" relationship `calculateGoogleCost` documents for Gemini's
 * `candidatesTokenCount`/`thoughtsTokenCount`, and unlike Mistral's completion tokens, which do not
 * document reasoning tokens as a subset). Both cache-read and cache-write tokens are therefore deducted
 * from the base prompt count, and reasoning tokens are deducted from the base completion count, before
 * billing the base prompt/completion rates — this avoids double-billing the cached/reasoning portions at
 * both the base rate and their own dedicated rate. `Math.max(0, ...)` clamps guard against the subset
 * counts exceeding the reported total (defensive, mirroring `calculateMistralCost`/`calculateDeepSeekCost`).
 *
 * This formula (deducting cache-read/cache-write from prompt tokens, and reasoning from completion tokens,
 * before applying the base rates) is a design choice modeled on `calculateGoogleCost` (reasoning
 * subtraction), `calculateDeepSeekCost`/`calculateAnthropicCost` (explicit cache-write cost term), and
 * `calculateMistralCost` (cache-read deduction from base prompt, defensive clamps) — the issue that
 * introduced this package only specifies the raw usage field *names*, not the billing formula.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateAzureCost = (params: {
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

  // Responses-API `input_tokens` is the total prompt count; `cached_tokens` and `cache_write_tokens`
  // are both subsets of it, so deduct both before billing the base prompt rate.
  const basePromptTokens = Math.max(
    0,
    usage.promptTokens - cacheReadTokens - cacheWriteTokens,
  );

  // Responses-API `output_tokens` includes `reasoning_tokens` as a subset (same relationship as
  // Google's `candidatesTokenCount`/`thoughtsTokenCount`).
  const baseCompletionTokens = Math.max(
    0,
    usage.completionTokens - reasoningTokens,
  );

  const promptCost = multiplyCost(
    rateToCost(pricing.promptTokens),
    basePromptTokens,
  );

  const completionCost = multiplyCost(
    rateToCost(pricing.completionTokens),
    baseCompletionTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens ?? 0),
    cacheReadTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens ?? 0),
    cacheWriteTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? 0),
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
