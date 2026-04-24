import { calculateGoogleCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
import type { CostInputs } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/core';
import { JSONObject, SharedV3ProviderMetadata } from '@ai-sdk/provider';

interface GoogleTokenDetail extends JSONObject {
  modality: string;
  tokenCount: number;
}

interface GoogleUsageAccounting extends JSONObject {
  promptTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  totalTokenCount?: number | null;
  cachedContentTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
  trafficType?: string | null;
  promptTokensDetails?: GoogleTokenDetail[] | null;
  candidatesTokensDetails?: GoogleTokenDetail[] | null;
}

type GoogleProviderMetadata = SharedV3ProviderMetadata & {
  google?: { usageMetadata: GoogleUsageAccounting };
};

/**
 * Configuration for {@link createGoogleV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized Google usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface GoogleV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Google provider (`@ai-sdk/google`).
 * Maps AI SDK usage into billing fields and resolves cost from pricing plus usage.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link GoogleV3MiddlewareOptions}.
 * @returns A V3 billing middleware instance for Google.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/google` (`createGoogleV3Middleware` is this function's export
 * alias from `@ai-billing/google`).
 *
 * ```ts
 * import { createGoogleGenerativeAI } from '@ai-sdk/google';
 * import { wrapLanguageModel } from 'ai';
 * import { createGoogleV3Middleware } from '@ai-billing/google';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_STUDIO_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *  'models/gemini-3.1-flash-lite-preview': {
 *    promptTokens: 0.00000025, // $0.25 per 1M tokens
 *    completionTokens: 0.0000015, // $1.50 per 1M tokens
 *    inputCacheReadTokens: 0.000000025, // $0.025 per 1M tokens
 *    internalReasoningTokens: 0.0000015, // $1.50 per 1M tokens
 *  },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createGoogleV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: google('models/gemini-3.1-flash-lite-preview'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGoogleV3Middleware<TTags extends DefaultTags>(
  options: GoogleV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage: _usage,
      providerMetadata,
      responseId,
      tags,
    }) => {
      const googleMetadata = providerMetadata as
        | GoogleProviderMetadata
        | undefined;

      const inputTokensTotal =
        googleMetadata?.google?.usageMetadata?.promptTokenCount ?? 0;
      const inputTokensCacheRead =
        googleMetadata?.google?.usageMetadata?.cachedContentTokenCount ?? 0;
      const outputTokensTotal =
        (googleMetadata?.google?.usageMetadata?.candidatesTokenCount ?? 0) +
        (googleMetadata?.google?.usageMetadata?.thoughtsTokenCount ?? 0);

      const outputTokensReasoning =
        googleMetadata?.google?.usageMetadata?.thoughtsTokenCount ?? 0;

      const googleAIUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal ?? 0,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: outputTokensReasoning,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'google',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateGoogleCost({
        pricing,
        usage: googleAIUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'google',
        tags: tags,
        usage: toUsage(googleAIUsage),
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
