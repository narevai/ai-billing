import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  AiBillingExtractorError,
  DefaultTags,
  BillingEvent,
} from '@ai-billing/core';
import type { SharedV3ProviderMetadata } from '@ai-sdk/provider';

export interface GatewayAttempt {
  provider: string;
  internalModelId: string;
  providerApiModelId: string;
  credentialType: 'system' | 'user';
  success: boolean;
  startTime: number;
  endTime: number;
  statusCode: number;
  providerResponseId: string;
}

export interface GatewayModelAttempt {
  modelId: string;
  canonicalSlug: string;
  success: boolean;
  providerAttemptCount: number;
  providerAttempts: GatewayAttempt[];
}

export interface GatewayRouting {
  originalModelId: string;
  resolvedProvider: string;
  resolvedProviderApiModelId: string;
  internalResolvedModelId: string;
  fallbacksAvailable: string[];
  internalReasoning: string;
  planningReasoning: string;
  canonicalSlug: string;
  finalProvider: string;
  attempts: GatewayAttempt[];
  modelAttemptCount: number;
  modelAttempts: GatewayModelAttempt[];
  totalProviderAttemptCount: number;
}

export type GatewayProviderMetadata = SharedV3ProviderMetadata & {
  gateway?: {
    generationId: string;
    cost?: string;
    marketCost?: string;
    enabledZeroDataRetention: boolean;
    enabledDisallowPromptTraining: boolean;
    routing?: GatewayRouting;
  };
};

/**
 * Configuration for {@link createGatewayV3Middleware}.
 *
 * The shape matches {@link BaseBillingMiddlewareOptions}: `destinations`, `defaultTags`, `waitUntil`, and
 * `onError`. The gateway middleware does not add provider-specific fields (for example there is no
 * `priceResolver`). Model cost is read from AI Gateway metadata (`gateway.cost` / `gateway.marketCost` on
 * the response) rather than from a local pricing table.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}. Defaults to standard tags.
 */
export interface GatewayMiddlewareOptions<
  TTags extends DefaultTags = DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {}

/**
 * Creates a V3 billing middleware configured for the Vercel AI Gateway provider.
 * Extracts cost and usage data from gateway-specific provider metadata.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}. Defaults to standard tags.
 * @param options - Shared billing options; see {@link GatewayMiddlewareOptions} for what you can pass and
 * what is implied by the gateway provider.
 * @returns A V3 billing middleware instance for the AI Gateway.
 *
 * @example
 * Same wiring as `examples/dev-sandbox/app/api/gateway` (`createGatewayMiddleware` is this function’s export
 * alias from `@ai-billing/gateway`).
 *
 * ```ts
 * import { createGateway, wrapLanguageModel } from 'ai';
 * import { createGatewayMiddleware } from '@ai-billing/gateway';
 * import { consoleDestination } from '@ai-billing/core';
 *
 * const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
 *
 * const billingMiddleware = createGatewayMiddleware({
 *   destinations: [consoleDestination()],
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: gateway('gpt-5'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGatewayV3Middleware<TTags extends DefaultTags>(
  options: GatewayMiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: ({ model, usage, providerMetadata, responseId, tags }) => {
      const gatewayMetadata = providerMetadata as
        | GatewayProviderMetadata
        | undefined;

      const gatewayCost = Number(gatewayMetadata?.gateway?.cost ?? '0');
      const upstreamCost = Number(gatewayMetadata?.gateway?.marketCost ?? '0');

      const resolvedCost = gatewayCost || upstreamCost;

      if (!resolvedCost || isNaN(resolvedCost)) {
        throw new AiBillingExtractorError({
          message: `Expected cost or marketCost to be a valid number.`,
          cause: gatewayMetadata,
        });
      }

      return {
        generationId:
          responseId ??
          gatewayMetadata?.gateway?.generationId ??
          crypto.randomUUID(),
        modelId: model.modelId,
        provider: model.provider || 'gateway',
        tags: tags,
        usage: {
          subProvider: gatewayMetadata?.gateway?.routing?.finalProvider,
          inputTokens: usage?.inputTokens.total ?? 0,
          outputTokens: usage?.outputTokens.total ?? 0,
          cacheReadTokens: usage?.inputTokens.cacheRead ?? 0,
          cacheWriteTokens: usage?.inputTokens.cacheWrite ?? 0,
          reasoningTokens: usage?.outputTokens.reasoning ?? 0,
          totalTokens:
            (usage?.outputTokens.total ?? 0) + (usage?.inputTokens.total ?? 0),
          rawProviderCost: gatewayCost,
          rawUpstreamInferenceCost: upstreamCost,
        },
        cost: {
          amount: resolvedCost,
          unit: 'base',
          currency: 'USD',
        },
      } satisfies BillingEvent<TTags>;
    },
  });
}
