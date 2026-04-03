import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createGatewayV3Middleware,
  GatewayProviderMetadata,
} from './language-model-v3-ai-gateway-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { AiBillingExtractorError, BillingEvent } from '@ai-billing/core';
import {
  LanguageModelV3GenerateResult,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import { z } from 'zod';

describe('GatewayBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const realMetadata: GatewayProviderMetadata = {
    gateway: {
      generationId: 'gen_01KN3XTWSNX1KQQJC782ADWPCJ',
      cost: '0',
      marketCost: '0.00096',
      enabledZeroDataRetention: false,
      enabledDisallowPromptTraining: false,
      routing: {
        originalModelId: 'anthropic/claude-opus-4',
        resolvedProvider: 'anthropic',
        resolvedProviderApiModelId: 'claude-opus-4-20250514',
        internalResolvedModelId: 'anthropic:claude-opus-4-20250514',
        fallbacksAvailable: ['vertexAnthropic', 'bedrock'],
        internalReasoning:
          'Selected anthropic as preferred provider for claude-opus-4.',
        planningReasoning: 'BYOK credentials available for: anthropic.',
        canonicalSlug: 'anthropic/claude-opus-4',
        finalProvider: 'anthropic',
        attempts: [
          {
            provider: 'anthropic',
            internalModelId: 'anthropic:claude-opus-4-20250514',
            providerApiModelId: 'claude-opus-4-20250514',
            credentialType: 'system',
            success: true,
            startTime: 373472.60056,
            endTime: 374850.548128,
            statusCode: 200,
            providerResponseId: 'msg_0148249ws4DisA84opkn9LsD',
          },
        ],
        modelAttemptCount: 1,
        modelAttempts: [
          {
            modelId: 'anthropic:claude-opus-4-20250514',
            canonicalSlug: 'anthropic/claude-opus-4',
            success: true,
            providerAttemptCount: 1,
            providerAttempts: [], //omitted for previty
          },
        ],
        totalProviderAttemptCount: 1,
      },
    },
  };

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'The capital of Sweden is Stockholm.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'end_turn' },
    usage: {
      inputTokens: { total: 14, noCache: 14, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    response: {
      id: 'aitxt-jXkwmH5edGJe3YPK2QvqFuHN',
      timestamp: new Date('2026-04-01T07:06:30.155Z'),
    },
    providerMetadata: realMetadata as SharedV3ProviderMetadata,
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract rich billing data and broadcast it with sub-provider info', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGatewayV3Middleware({
        destinations: [destinationSpy],
      });

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of Sweden?' });

      expect(destinationSpy).toHaveBeenCalledTimes(1);
      const emittedPayload = destinationSpy.mock.calls[0]![0];

      let parsedEmittedEvent: BillingEvent;

      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();

      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider || 'gateway',
        usage: {
          subProviderId: realMetadata.gateway?.routing?.finalProvider,
          inputTokens: baseResult.usage?.inputTokens.total,
          outputTokens: baseResult.usage?.outputTokens.total,
          cacheReadTokens: baseResult.usage?.inputTokens.cacheRead,
          cacheWriteTokens: baseResult.usage?.inputTokens.cacheWrite,
          reasoningTokens: baseResult.usage?.outputTokens.reasoning,
          totalTokens:
            baseResult.usage?.inputTokens.total! +
            baseResult.usage?.outputTokens.total!,
          rawProviderCost: Number(realMetadata.gateway?.cost),
          rawUpstreamInferenceCost: Number(realMetadata.gateway?.marketCost),
        },
        cost: {
          amount: Number(realMetadata.gateway?.marketCost),
          unit: 'base',
          currency: 'USD',
        },
        tags: {},
      });
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    });
  });

  describe('wrapStream', () => {
    it('should extract billing data correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGatewayV3Middleware({
        destinations: [destinationSpy],
      });

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'gateway', // Updated to 'gateway' to match your log, though any string works
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: baseResult.response!.id! },
            { type: 'text-start', id: baseResult.response!.id! },
            {
              type: 'finish',
              finishReason: baseResult.finishReason,
              usage: baseResult.usage,
              providerMetadata: baseResult.providerMetadata,
            },
          ]),
          response: baseResult.response,
        }),
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      const result = streamText({ model: wrappedModel, prompt: 'Hi' });
      await result.text;

      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();

      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          subProviderId: realMetadata.gateway?.routing?.finalProvider,
          inputTokens: baseResult.usage?.inputTokens.total,
          outputTokens: baseResult.usage?.outputTokens.total,
          cacheReadTokens: baseResult.usage?.inputTokens.cacheRead,
          cacheWriteTokens: baseResult.usage?.inputTokens.cacheWrite,
          reasoningTokens: baseResult.usage?.outputTokens.reasoning,
          totalTokens:
            baseResult.usage?.inputTokens.total! +
            baseResult.usage?.outputTokens.total!,
          rawProviderCost: Number(realMetadata.gateway?.cost),
          rawUpstreamInferenceCost: Number(realMetadata.gateway?.marketCost),
        },
        cost: {
          amount: Number(realMetadata.gateway?.marketCost),
          unit: 'base',
          currency: 'USD',
        },
        tags: {},
      });
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    });
  });

  it('should trigger onError when OpenRouter cost metadata is missing', async () => {
    const onErrorSpy = vi.fn();

    const middleware = createGatewayV3Middleware({
      destinations: [vi.fn()],
      onError: onErrorSpy,
    });

    const baseResult = createResult({
      providerMetadata: {
        openrouter: { usage: {} },
      } as SharedV3ProviderMetadata,
    });

    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

    await generateText({
      model: wrappedModel,
      prompt: 'Hello',
    });

    expect(onErrorSpy).toHaveBeenCalledTimes(1);

    const error = onErrorSpy.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AiBillingExtractorError);
    expect(error.message).toContain('Expected');
  });

  it('should hit all fallback branches for full coverage', async () => {
    const destinationSpy = vi.fn();
    const middleware = createGatewayV3Middleware({
      destinations: [destinationSpy],
    });

    const baseResult = createResult({
      response: { id: undefined }, // Hits: crypto.randomUUID fallback
      usage: {
        inputTokens: {
          total: undefined,
          noCache: 0,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: undefined,
          text: 0,
          reasoning: undefined,
        },
      },
      providerMetadata: {
        gateway: {
          cost: '0.000004653', // Bypasses the initial cost error check
        },
      } as SharedV3ProviderMetadata,
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'test-model',
      provider: '', // Hits: model.provider || 'gateway'
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    await vi.waitFor(() => expect(destinationSpy).toHaveBeenCalledTimes(1));
    const emittedPayload = destinationSpy.mock.calls[0]![0];
    let parsedEmittedEvent: BillingEvent;
    expect(() => {
      parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
    }).not.toThrow();

    const expectedEvent = StrictBillingEventSchema.parse({
      generationId: parsedEmittedEvent!.generationId, // Inject fallback UUID
      modelId: mockModel.modelId,
      provider: 'gateway', // Fallback provider
      usage: {
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        rawProviderCost: 0.000004653,
      },
      cost: {
        amount: 0.000004653,
        unit: 'base',
        currency: 'USD',
      },
      tags: {},
    });

    expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    expect(parsedEmittedEvent!.generationId).toHaveLength(36);
  });
});
