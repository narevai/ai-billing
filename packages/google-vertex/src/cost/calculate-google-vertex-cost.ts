import {
  addCosts,
  applyDiscount,
  multiplyCost,
  rateToCost,
} from '@ai-billing/core';
import type { ModelPricing, Cost, CostInputs } from '@ai-billing/types';

/**
 * Computes total cost for a Google Vertex AI completion from {@link ModelPricing} and token usage.
 *
 * Vertex's Gemini models report reasoning ("thoughts") tokens separately from `candidatesTokenCount`
 * (`thoughtsTokenCount`), so they are subtracted from the completion count before billing the base
 * completion rate and billed separately at the reasoning rate — same rule as `@ai-billing/google`'s
 * `calculateGoogleCost`, since Vertex uses the same Gemini-native usage shape.
 *
 * Known gap: Vertex usage also reports `trafficType` (`ON_DEMAND` vs `PROVISIONED`). {@link ModelPricing}
 * has no field to bill provisioned-throughput traffic at a different (or zero) rate, so this calculator
 * bills every call at the same resolved rate regardless of `trafficType`. See the middleware's
 * `GoogleVertexUsageAccounting.trafficType` doc comment.
 *
 * @param params - Calculation inputs: `pricing` is {@link ModelPricing} or `undefined` when the model is not
 * in your table; `usage` is token counts as {@link CostInputs}.
 * @returns A {@link Cost}, or `undefined` when `pricing` is missing.
 * @internal
 */
export const calculateGoogleVertexCost = (params: {
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
    usage.completionTokens - usage.reasoningTokens,
  );

  const cacheReadCost = multiplyCost(
    rateToCost(pricing.inputCacheReadTokens ?? 0),
    usage.cacheReadTokens,
  );

  const cacheWriteCost = multiplyCost(
    rateToCost(pricing.inputCacheWriteTokens),
    usage.cacheWriteTokens,
  );

  const reasoningCost = multiplyCost(
    rateToCost(pricing.internalReasoningTokens ?? 0),
    usage.reasoningTokens,
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
