import { calculateAzureCost } from '../../../cost/index.js';
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

/**
 * Raw Responses-API usage payload, as returned by Azure AI Foundry (`provider: "azure.responses"`) and
 * surfaced via the AI SDK's `usage.raw`. Field names match the OpenAI Responses API (`@ai-sdk/azure` reuses
 * `@ai-sdk/openai`'s Responses-API implementation under the hood), not classic Azure OpenAI Chat
 * Completions' `prompt_tokens`/`completion_tokens` naming.
 */
export interface AzureV3UsageAccounting extends JSONObject {
  input_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  output_tokens?: number;
  output_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
  service_tier?: string | null;
}

/**
 * Configuration for {@link createAzureV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the raw Responses-API usage payload when present,
 * falling back to the AI SDK's normalized usage fields otherwise; cost is computed from that usage and the
 * resolved {@link ModelPricing} using the same rules as the package's cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface AzureV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Azure provider (`@ai-sdk/azure`), specifically Azure AI Foundry
 * (`*.services.ai.azure.com`), which the AI SDK routes through the Responses API (`azure.responses`).
 * Prefers the raw Responses-API usage field names (`input_tokens`/`output_tokens` and their `_details`
 * subfields) and falls back to the AI SDK's normalized usage fields when `usage.raw` is absent.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link AzureV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Azure.
 *
 * @example
 * ```ts
 * import { createAzure } from '@ai-sdk/azure';
 * import { wrapLanguageModel } from 'ai';
 * import { createAzureV3Middleware } from '@ai-billing/azure';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const azure = createAzure({
 *   apiKey: process.env.AZURE_API_KEY,
 *   baseURL: `${process.env.AZURE_URL?.replace(/\/+$/, '')}/openai/v1`,
 *   apiVersion: 'preview',
 * });
 *
 * const deployment = process.env.AZURE_DEPLOYMENT ?? 'DeepSeek-V4-Pro';
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   [deployment]: {
 *     promptTokens: 2.0 / 1_000_000,
 *     completionTokens: 6.0 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createAzureV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: azure(deployment),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createAzureV3Middleware<TTags extends DefaultTags>(
  options: AzureV3MiddlewareOptions<TTags>,
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
      const azureRawUsage = usage?.raw as AzureV3UsageAccounting | undefined;

      const inputTokensTotal =
        azureRawUsage?.input_tokens ?? usage?.inputTokens?.total ?? 0;
      const outputTokensTotal =
        azureRawUsage?.output_tokens ?? usage?.outputTokens?.total ?? 0;
      const inputTokensCacheRead =
        azureRawUsage?.input_tokens_details?.cached_tokens ??
        usage?.inputTokens?.cacheRead ??
        0;
      const inputTokensCacheWrite =
        azureRawUsage?.input_tokens_details?.cache_write_tokens ??
        usage?.inputTokens?.cacheWrite ??
        0;
      const outputTokensReasoning =
        azureRawUsage?.output_tokens_details?.reasoning_tokens ??
        usage?.outputTokens?.reasoning ??
        0;

      const azureUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'azure',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateAzureCost({
        pricing,
        usage: azureUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'azure',
        tags,
        usage: toUsage(azureUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
