import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import { createGoogleVertexV3Middleware } from './language-model-v3-google-vertex-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('GoogleVertexBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.0000003, // $0.30 per 1M
    completionTokens: 0.0000025, // $2.50 per 1M
    inputCacheReadTokens: 0.000000075, // $0.075 per 1M
    inputCacheWriteTokens: 0.000000375,
    internalReasoningTokens: 0.0000025, // Same as completion rate
    request: 0,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  // Ground truth captured from a real `generateText` call to `gemini-2.5-flash` via
  // `@ai-sdk/google-vertex`'s `createVertex()` (see issue #314). `thoughtsTokenCount` (50) is NOT
  // included in `candidatesTokenCount` (9) and must be added back for completion billing.
  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'The capital of Sweden is **Stockholm**.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'STOP' },
    usage: {
      inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 59, text: 9, reasoning: 50 },
    },
    response: { id: '9mCeavOJHqSGzvgPsNjhmQs', timestamp: new Date() },
    providerMetadata: {
      vertex: {
        usageMetadata: {
          promptTokenCount: 7,
          candidatesTokenCount: 9,
          thoughtsTokenCount: 50,
          totalTokenCount: 66,
          trafficType: 'ON_DEMAND',
          promptTokensDetails: [{ modality: 'TEXT', tokenCount: 7 }],
          candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 9 }],
        },
      },
    },
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured gemini-2.5-flash payload', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGoogleVertexV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: 'google.vertex.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'gemini-2.5-flash',
        providerId: 'google-vertex',
      });

      // Prompt: 7 * 0.0000003 * 1e9 = 2,100 nanos
      // Completion (excluding reasoning): (9 + 50 - 50) * 0.0000025 * 1e9 = 22,500 nanos
      // Reasoning: 50 * 0.0000025 * 1e9 = 125,000 nanos
      // Total: 2,100 + 22,500 + 125,000 = 149,600 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'google-vertex',
        usage: {
          inputTokens: 7,
          outputTokens: 59,
          cacheReadTokens: 0,
          reasoningTokens: 50,
          subProvider: 'ON_DEMAND',
        },
        cost: {
          amount: 149600,
          unit: 'nanos',
          currency: 'USD',
        },
        tags: {},
      });

      expect(destinationSpy).toHaveBeenCalledTimes(1);
      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent!);
    });

    it('should deduct cache-read tokens from a synthetic usage log with cachedContentTokenCount > 0', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGoogleVertexV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const resultWithCache = createResult({
        usage: {
          inputTokens: { total: 100, noCache: 70, cacheRead: 30, cacheWrite: 0 },
          outputTokens: { total: 40, text: 40, reasoning: 0 },
        },
        providerMetadata: {
          vertex: {
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 40,
              thoughtsTokenCount: 0,
              cachedContentTokenCount: 30,
              totalTokenCount: 140,
              trafficType: 'ON_DEMAND',
            },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: 'google.vertex.chat',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(100);
      expect(parsedEvent.usage.cacheReadTokens).toBe(30);
      expect(parsedEvent.usage.outputTokens).toBe(40);
      expect(parsedEvent.usage.reasoningTokens).toBe(0);

      // prompt: 100 * 0.0000003 * 1e9 = 30,000 nanos
      // completion: 40 * 0.0000025 * 1e9 = 100,000 nanos
      // cacheRead: 30 * 0.000000075 * 1e9 = 2,250 nanos
      // Total: 30,000 + 100,000 + 2,250 = 132,250 nanos
      expect(parsedEvent.cost?.amount).toBe(132250);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should compute identical cost for a synthetic PROVISIONED-traffic call as an equivalent ON_DEMAND call (known, tested billing gap)', async () => {
      const onDemandDestinationSpy = vi.fn();
      const onDemandMiddleware = createGoogleVertexV3Middleware({
        destinations: [onDemandDestinationSpy],
        priceResolver: mockPriceResolver,
      });

      const provisionedDestinationSpy = vi.fn();
      const provisionedMiddleware = createGoogleVertexV3Middleware({
        destinations: [provisionedDestinationSpy],
        priceResolver: mockPriceResolver,
      });

      const provisionedResult = createResult({
        providerMetadata: {
          vertex: {
            usageMetadata: {
              promptTokenCount: 7,
              candidatesTokenCount: 9,
              thoughtsTokenCount: 50,
              totalTokenCount: 66,
              trafficType: 'PROVISIONED',
            },
          },
        },
      });

      const onDemandModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: 'google.vertex.chat',
        doGenerate: async () => createResult(),
      });
      const provisionedModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: 'google.vertex.chat',
        doGenerate: async () => provisionedResult,
      });

      await generateText({
        model: wrapLanguageModel({
          model: onDemandModel,
          middleware: onDemandMiddleware,
        }),
        prompt: 'What is the capital of Sweden?',
      });
      await generateText({
        model: wrapLanguageModel({
          model: provisionedModel,
          middleware: provisionedMiddleware,
        }),
        prompt: 'What is the capital of Sweden?',
      });

      const onDemandEvent = StrictBillingEventSchema.parse(
        onDemandDestinationSpy.mock.calls[0]![0],
      );
      const provisionedEvent = StrictBillingEventSchema.parse(
        provisionedDestinationSpy.mock.calls[0]![0],
      );

      expect(onDemandEvent.usage.subProvider).toBe('ON_DEMAND');
      expect(provisionedEvent.usage.subProvider).toBe('PROVISIONED');
      expect(provisionedEvent.cost).toEqual(onDemandEvent.cost);
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createGoogleVertexV3Middleware({
        destinations: [destinationSpy],
        priceResolver: missingPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'unknown-future-gemini-model',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Hello' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();
      expect(parsedEmittedEvent!).not.toHaveProperty('cost');
    });

    it('should hit all fallback branches for full coverage (UUID generation, missing metadata)', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGoogleVertexV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult({
        response: { id: undefined },
        providerMetadata: {},
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: '',
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
        generationId: parsedEmittedEvent!.generationId,
        modelId: mockModel.modelId,
        provider: 'google-vertex',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: { amount: 0, unit: 'nanos', currency: 'USD' },
        tags: {},
      });

      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
      expect(parsedEmittedEvent!).not.toHaveProperty('usage.subProvider');
      expect(parsedEmittedEvent!.generationId).toHaveLength(36);
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGoogleVertexV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'gemini-2.5-flash',
        provider: 'google.vertex.chat',
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
      const result = streamText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });
      await result.text;

      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'google-vertex',
        usage: {
          inputTokens: 7,
          outputTokens: 59,
          cacheReadTokens: 0,
          reasoningTokens: 50,
          subProvider: 'ON_DEMAND',
        },
        cost: {
          amount: 149600,
          unit: 'nanos',
          currency: 'USD',
        },
        tags: {},
      });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();

      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    });
  });
});
