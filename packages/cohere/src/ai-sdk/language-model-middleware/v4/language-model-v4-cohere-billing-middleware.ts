import { calculateCohereCost } from '../../../cost/index.js';
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

/**
 * Cohere's chat-completion `usage` payload (`usage.raw` on the AI SDK's normalized usage). Cohere reports
 * three independent counters that do not reconcile with each other by subtraction:
 *
 * - `tokens.input_tokens`/`tokens.output_tokens` — the raw, total tokens processed/produced, including cache hits
 *   and Cohere-injected framework tokens.
 * - `billed_units.input_tokens`/`billed_units.output_tokens` — the tokens Cohere actually charges for. This is what
 *   billing must be computed from.
 * - `cached_tokens` — an informational count of prompt tokens served from Cohere's inference cache. Cohere
 *   does not publish a discounted cached-input rate, and this count does not subtract cleanly from either
 *   `tokens.input_tokens` or `billed_units.input_tokens` (a captured `command-r-08-2024` response reported
 *   `tokens.input_tokens: 207`, `cached_tokens: 192`, and `billed_units.input_tokens: 7` — `207 - 192 = 15`,
 *   not `7`).
 */
export interface CohereV4UsageAccounting extends JSONObject {
  billed_units?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
  } | null;
  tokens?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
  } | null;
  cached_tokens?: number | null;
}

/**
 * Configuration for {@link createCohereV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface CohereV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Cohere provider (`@ai-sdk/cohere`).
 *
 * Bills off `billed_units.input_tokens`/`billed_units.output_tokens` (falling back to `tokens.input_tokens`/
 * `tokens.output_tokens` only when `billed_units` is entirely absent from the payload) — **not** the raw
 * `tokens.*` totals — since Cohere only charges for `billed_units`. `cached_tokens` is surfaced on the
 * emitted event's `usage.cacheReadTokens` for observability, but is not subtracted from the billed prompt
 * total (unlike Mistral) because `billed_units` already nets out cache hits in a way that isn't
 * reproducible by subtracting `cached_tokens` from `tokens.input_tokens`. As a result, `usage.inputTokens`/
 * `usage.outputTokens` on the emitted {@link BillingEvent} reflect Cohere's *billed* token counts, which
 * can be substantially smaller than the AI SDK's own normalized `inputTokens`/`outputTokens` totals when a
 * request hits Cohere's inference cache.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link CohereV4MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V4 billing middleware instance for Cohere.
 *
 * @example
 * ```ts
 * import { createCohere } from '@ai-sdk/cohere';
 * import { wrapLanguageModel } from 'ai';
 * import { createCohereV4Middleware } from '@ai-billing/cohere';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const cohere = createCohere({ apiKey: process.env.COHERE_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'command-r-08-2024': {
 *     promptTokens: 0.15 / 1_000_000,
 *     completionTokens: 0.6 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createCohereV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: cohere('command-r-08-2024'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createCohereV4Middleware<TTags extends DefaultTags>(
  options: CohereV4MiddlewareOptions<TTags>,
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
      const cohereRawUsage = usage?.raw as
        | CohereV4UsageAccounting
        | undefined;

      const inputTokensBilled =
        cohereRawUsage?.billed_units?.input_tokens ??
        cohereRawUsage?.tokens?.input_tokens ??
        0;
      const outputTokensBilled =
        cohereRawUsage?.billed_units?.output_tokens ??
        cohereRawUsage?.tokens?.output_tokens ??
        0;
      const inputTokensCacheRead = cohereRawUsage?.cached_tokens ?? 0;

      const cohereUsage: CostInputs = {
        promptTokens: inputTokensBilled,
        completionTokens: outputTokensBilled,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'cohere',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateCohereCost({
        pricing,
        usage: cohereUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'cohere',
        tags,
        usage: toUsage(cohereUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
