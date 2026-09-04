import { calculateDeepinfraCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
import type {
  CostInputs,
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/types';
import { JSONObject } from '@ai-sdk/provider';

export interface DeepinfraV3UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  /**
   * Speculative: DeepInfra's chat completions usage payload does not currently expose a
   * `completion_tokens_details.reasoning_tokens` field in any confirmed response (including the
   * sample generate-text response this package was built from). This is included defensively for
   * DeepInfra-hosted reasoning models (e.g. DeepSeek-R1 variants) that may report reasoning tokens the
   * same way OpenAI-compatible APIs do. It defaults to `0` when absent, so billing is unaffected
   * until/unless a given model actually starts returning it.
   */
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  /**
   * DeepInfra's own USD cost estimate for the request. This is surfaced informationally on the emitted
   * `usage.rawProviderCost` (see {@link createDeepinfraV3Middleware}) but is never used as the billed
   * `cost` — the billed cost is always computed from the integrator-supplied {@link ModelPricing} table,
   * the same as every other non-aggregator provider package in this repo.
   */
  estimated_cost?: number;
  service_tier?: string | null;
}

/**
 * Configuration for {@link createDeepinfraV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface DeepinfraV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the DeepInfra provider (`@ai-sdk/deepinfra`).
 * Deducts cache-read tokens from prompt tokens before billing — DeepInfra charges only non-cached input at
 * the prompt rate, and cached tokens separately at the cache-read rate.
 *
 * DeepInfra's raw usage payload may include its own `estimated_cost` (a USD estimate). That value is never
 * used as the billed cost — cost is always computed from the resolved {@link ModelPricing} table — but when
 * present and numeric it is additionally surfaced as `usage.rawProviderCost` for informational purposes.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link DeepinfraV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for DeepInfra.
 *
 * @example
 * ```ts
 * import { createDeepInfra } from '@ai-sdk/deepinfra';
 * import { wrapLanguageModel } from 'ai';
 * import { createDeepinfraV3Middleware } from '@ai-billing/deepinfra';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const deepInfra = createDeepInfra({ apiKey: process.env.DEEPINFRA_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'meta-llama/Llama-3.3-70B-Instruct': {
 *     promptTokens: 0.13 / 1_000_000,
 *     completionTokens: 0.4 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createDeepinfraV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: deepInfra('meta-llama/Llama-3.3-70B-Instruct'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createDeepinfraV3Middleware<TTags extends DefaultTags>(
  options: DeepinfraV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const deepinfraRawUsage = usage?.raw as
        | DeepinfraV3UsageAccounting
        | undefined;

      const inputTokensTotal = deepinfraRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = deepinfraRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        deepinfraRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        deepinfraRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const deepinfraUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'deepinfra',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateDeepinfraCost({
        pricing,
        usage: deepinfraUsage,
      });

      const rawEstimatedCost = deepinfraRawUsage?.estimated_cost;
      const hasRawProviderCost =
        typeof rawEstimatedCost === 'number' &&
        Number.isFinite(rawEstimatedCost);

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'deepinfra',
        tags,
        usage: {
          ...toUsage(deepinfraUsage),
          ...(hasRawProviderCost && { rawProviderCost: rawEstimatedCost }),
        },
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
