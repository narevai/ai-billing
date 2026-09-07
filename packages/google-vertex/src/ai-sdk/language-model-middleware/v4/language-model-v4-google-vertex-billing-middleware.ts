import { calculateGoogleVertexCost } from '../../../cost/index.js';
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
import { JSONObject, SharedV4ProviderMetadata } from '@ai-sdk/provider';

interface GoogleVertexTokenDetail extends JSONObject {
  modality: string;
  tokenCount: number;
}

/**
 * Raw usage payload Vertex AI reports under `providerMetadata.vertex.usageMetadata` — same Gemini-native
 * field names as `@ai-sdk/google`'s `GoogleGenerativeAIProviderMetadata` (`promptTokenCount` /
 * `candidatesTokenCount` / `thoughtsTokenCount` / `totalTokenCount`), plus Vertex-specific `trafficType`.
 */
interface GoogleVertexUsageAccounting extends JSONObject {
  promptTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  totalTokenCount?: number | null;
  cachedContentTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
  /**
   * `'ON_DEMAND'` (pay-as-you-go) or `'PROVISIONED'` (committed throughput). Surfaced on the billing
   * event's `usage.subProvider` for downstream visibility; NOT used to change the billed rate, since
   * {@link ModelPricing} has no field for a provisioned-throughput rate. See
   * {@link calculateGoogleVertexCost}'s doc comment for details on this known, intentional gap.
   */
  trafficType?: string | null;
  promptTokensDetails?: GoogleVertexTokenDetail[] | null;
  candidatesTokensDetails?: GoogleVertexTokenDetail[] | null;
}

type GoogleVertexProviderMetadata = SharedV4ProviderMetadata & {
  vertex?: { usageMetadata: GoogleVertexUsageAccounting };
};

/**
 * Configuration for {@link createGoogleVertexV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from Vertex's Gemini-native `usageMetadata` fields; cost
 * is computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's
 * cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface GoogleVertexV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Google Vertex AI provider (`@ai-sdk/google-vertex`).
 * Maps Vertex's Gemini-native usage into billing fields (adding `thoughtsTokenCount` back into the billed
 * completion count) and resolves cost from pricing plus usage.
 *
 * Vertex's `trafficType` (`ON_DEMAND` vs `PROVISIONED`) is surfaced on the emitted event's
 * `usage.subProvider`, but is **not** used to change the billed rate — provisioned-throughput calls are
 * billed at the same resolved rate as on-demand calls. See {@link calculateGoogleVertexCost}.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link GoogleVertexV4MiddlewareOptions}.
 * @returns A V4 billing middleware instance for Google Vertex AI.
 *
 * @example
 * ```ts
 * import { createVertex } from '@ai-sdk/google-vertex';
 * import { wrapLanguageModel } from 'ai';
 * import { createGoogleVertexV4Middleware } from '@ai-billing/google-vertex';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const vertex = createVertex({
 *   project: process.env.GOOGLE_VERTEX_PROJECT,
 *   location: process.env.GOOGLE_VERTEX_LOCATION,
 * });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'gemini-2.5-flash': {
 *     promptTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
 *     completionTokens: 2.5 / 1_000_000, // $2.50 per 1M tokens
 *     internalReasoningTokens: 2.5 / 1_000_000, // $2.50 per 1M tokens
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createGoogleVertexV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: vertex('gemini-2.5-flash'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGoogleVertexV4Middleware<TTags extends DefaultTags>(
  options: GoogleVertexV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage: _usage,
      providerMetadata,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const vertexMetadata = providerMetadata as
        | GoogleVertexProviderMetadata
        | undefined;

      const inputTokensTotal =
        vertexMetadata?.vertex?.usageMetadata?.promptTokenCount ?? 0;
      const inputTokensCacheRead =
        vertexMetadata?.vertex?.usageMetadata?.cachedContentTokenCount ?? 0;
      const outputTokensReasoning =
        vertexMetadata?.vertex?.usageMetadata?.thoughtsTokenCount ?? 0;
      const outputTokensTotal =
        (vertexMetadata?.vertex?.usageMetadata?.candidatesTokenCount ?? 0) +
        outputTokensReasoning;
      const trafficType =
        vertexMetadata?.vertex?.usageMetadata?.trafficType ?? undefined;

      const googleVertexUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: outputTokensReasoning,
        webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'google-vertex',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateGoogleVertexCost({
        pricing,
        usage: googleVertexUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'google-vertex',
        tags,
        usage: {
          ...toUsage(googleVertexUsage),
          ...(trafficType !== undefined && { subProvider: trafficType }),
        },
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
