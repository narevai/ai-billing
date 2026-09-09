import {
  createV4BillingMiddleware,
  AiBillingExtractorError,
} from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  DefaultTags,
  BillingEvent,
} from '@ai-billing/types';
import type { SharedV4ProviderMetadata } from '@ai-sdk/provider';

export interface GatewayV4Attempt {
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

export interface GatewayV4ModelAttempt {
  modelId: string;
  canonicalSlug: string;
  success: boolean;
  providerAttemptCount: number;
  providerAttempts: GatewayV4Attempt[];
}

export interface GatewayV4Routing {
  originalModelId: string;
  resolvedProvider: string;
  resolvedProviderApiModelId: string;
  internalResolvedModelId: string;
  fallbacksAvailable: string[];
  internalReasoning: string;
  planningReasoning: string;
  canonicalSlug: string;
  finalProvider: string;
  attempts: GatewayV4Attempt[];
  modelAttemptCount: number;
  modelAttempts: GatewayV4ModelAttempt[];
  totalProviderAttemptCount: number;
}

export type GatewayV4ProviderMetadata = SharedV4ProviderMetadata & {
  gateway?: {
    generationId: string;
    cost?: string;
    marketCost?: string;
    enabledZeroDataRetention: boolean;
    enabledDisallowPromptTraining: boolean;
    routing?: GatewayV4Routing;
  };
};

/**
 * Configuration for {@link createGatewayV4Middleware}.
 *
 * The shape matches {@link BaseBillingMiddlewareOptions}: `destinations`, `defaultTags`, `waitUntil`, and
 * `onError`. The gateway middleware does not add provider-specific fields (for example there is no
 * `priceResolver`). Model cost is read from AI Gateway metadata (`gateway.cost` / `gateway.marketCost` on
 * the response) rather than from a local pricing table.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}. Defaults to standard tags.
 */
export interface GatewayV4MiddlewareOptions<
  TTags extends DefaultTags = DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {}

/**
 * Creates a V4 billing middleware configured for the Vercel AI Gateway provider.
 * Extracts cost and usage data from gateway-specific provider metadata.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}. Defaults to standard tags.
 * @param options - Shared billing options; see {@link GatewayV4MiddlewareOptions} for what you can pass and
 * what is implied by the gateway provider.
 * @returns A V4 billing middleware instance for the AI Gateway.
 *
 * @example
 * Targets AI SDK v7 (`LanguageModelV4Middleware`).
 *
 * ```ts
 * import { createGateway, wrapLanguageModel } from 'ai';
 * import { createGatewayV4Middleware } from '@ai-billing/gateway';
 * import { consoleDestination } from '@ai-billing/core';
 *
 * const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
 *
 * const billingMiddleware = createGatewayV4Middleware({
 *   destinations: [consoleDestination()],
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: gateway('gpt-5'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGatewayV4Middleware<TTags extends DefaultTags>(
  options: GatewayV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: ({ model, usage, providerMetadata, responseId, tags }) => {
      const gatewayMetadata = providerMetadata as
        | GatewayV4ProviderMetadata
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
          gatewayMetadata?.gateway?.generationId ??
          responseId ??
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
