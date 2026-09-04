import { calculateMoonshotaiCost } from '../../../cost/index.js';
import { createV4BillingMiddleware, toUsage } from '@ai-billing/core';
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

export interface MoonshotaiV4UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number | null;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  /**
   * Populated by reasoning models such as `kimi-k3`, which always reasons before answering. This is a
   * subset of `completion_tokens` (i.e. `completion_tokens` already includes these tokens), matching the
   * `@ai-sdk/moonshotai` package's own `convertMoonshotAIChatUsage` normalization.
   */
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createMoonshotaiV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the Moonshot AI response; cost is computed from
 * that usage and the resolved {@link ModelPricing} using the same rules as the package's cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface MoonshotaiV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Moonshot AI provider (`@ai-sdk/moonshotai`).
 *
 * Moonshot AI's chat-completions usage payload is OpenAI-compatible. Reasoning models (e.g. `kimi-k3`)
 * report `completion_tokens_details.reasoning_tokens` as a *subset* of `completion_tokens`, so this
 * middleware subtracts reasoning tokens out of `completion_tokens` before billing them as
 * `completionTokens`, and bills the reasoning tokens separately as `reasoningTokens` — avoiding
 * double-counting reasoning cost.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link MoonshotaiV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Moonshot AI.
 *
 * @example
 * ```ts
 * import { createMoonshotAI } from '@ai-sdk/moonshotai';
 * import { wrapLanguageModel } from 'ai';
 * import { createMoonshotaiV4Middleware } from '@ai-billing/moonshotai';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const moonshotai = createMoonshotAI({ apiKey: process.env.MOONSHOT_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'kimi-k3': {
 *     promptTokens: 3.0 / 1_000_000,
 *     completionTokens: 15.0 / 1_000_000,
 *     inputCacheReadTokens: 0.3 / 1_000_000,
 *     internalReasoningTokens: 15.0 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createMoonshotaiV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: moonshotai('kimi-k3'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createMoonshotaiV4Middleware<TTags extends DefaultTags>(
  options: MoonshotaiV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const moonshotaiRawUsage = usage?.raw as
        | MoonshotaiV4UsageAccounting
        | undefined;

      const inputTokensTotal = moonshotaiRawUsage?.prompt_tokens ?? 0;
      const completionTokensTotal =
        moonshotaiRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        moonshotaiRawUsage?.cached_tokens ??
        moonshotaiRawUsage?.prompt_tokens_details?.cached_tokens ??
        0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        moonshotaiRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;
      // completion_tokens includes reasoning_tokens as a subset for Moonshot AI's OpenAI-compatible
      // usage payload; subtract it out here so completionTokens is text-only and reasoning is billed
      // separately, without double-counting.
      const outputTokensText = Math.max(
        0,
        completionTokensTotal - outputTokensReasoning,
      );

      const moonshotaiUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensText,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'moonshotai',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateMoonshotaiCost({
        pricing,
        usage: moonshotaiUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'moonshotai',
        tags,
        usage: toUsage(moonshotaiUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
