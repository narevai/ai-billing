import {
  createV3BillingMiddleware,
  type BaseBillingMiddlewareOptions,
  AiBillingExtractorError,
  DefaultTags,
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

type GatewayMiddlewareOptions<TTags extends DefaultTags> =
  BaseBillingMiddlewareOptions<TTags>;

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
        timestamp: Date.now(),
        tags: tags,
        usage: {
          subProviderId: gatewayMetadata?.gateway?.routing?.finalProvider,
          inputTokens: usage?.inputTokens.total ?? 0,
          outputTokens: usage?.outputTokens.total ?? 0,
          cacheReadTokens: usage?.inputTokens.cacheRead ?? 0,
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
      };
    },
  });
}
