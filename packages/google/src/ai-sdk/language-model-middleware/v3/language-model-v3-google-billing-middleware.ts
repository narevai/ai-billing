import { calculateGoogleCost } from '../../../cost/index.js';
import type { GoogleCostInputs } from '../../../cost/index.js';
import { createV3BillingMiddleware } from '@ai-billing/core';
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

      const googleAIUsage: GoogleCostInputs = {
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
        usage: {
          inputTokens: inputTokensTotal,
          outputTokens: outputTokensTotal,
          cacheReadTokens: inputTokensCacheRead,
          reasoningTokens: outputTokensReasoning,
          totalTokens: inputTokensTotal + outputTokensTotal,
        },
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
