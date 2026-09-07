import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createAmazonBedrockV3Middleware,
  AmazonBedrockV3UsageAccounting,
} from './language-model-v3-amazon-bedrock-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('AmazonBedrockBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.00000006,
    completionTokens: 0.00000024,
    inputCacheReadTokens: 0.000000015,
    inputCacheWriteTokens: 0.0000000375,
    request: 0,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'The capital of Sweden is Stockholm.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: {
        total: 7,
        noCache: 7,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 850,
        text: 850,
        reasoning: 0,
      },
      // Sample raw usage as returned by the dev-sandbox's
      // `POST /api/raw/amazon-bedrock/generate-text` route (via `@ai-sdk/amazon-bedrock`'s
      // `createAmazonBedrock()`), model `us.amazon.nova-lite-v1:0`.
      raw: {
        inputTokens: 7,
        outputTokens: 850,
        totalTokens: 857,
        serverToolUsage: {},
      } as AmazonBedrockV3UsageAccounting,
    },
    response: { id: 'resp_bedrock_abc123', timestamp: new Date() },
    providerMetadata: { bedrock: { stopSequence: null } },
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured generateText usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAmazonBedrockV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'us.amazon.nova-lite-v1:0',
        provider: 'amazon-bedrock',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'us.amazon.nova-lite-v1:0',
        providerId: 'amazon-bedrock',
      });
      const rawUsage = baseResult.usage.raw as AmazonBedrockV3UsageAccounting;

      // prompt: 0.00000006 * 1e9 * 7 = 420 nanos
      // completion: 0.00000024 * 1e9 * 850 = 204,000 nanos
      // Total: 420 + 204,000 = 204,420 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'amazon-bedrock',
        usage: {
          inputTokens: rawUsage.inputTokens,
          outputTokens: rawUsage.outputTokens,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
        },
        cost: {
          amount: 204420,
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

    it('should add cache-read and cache-write cost on top of the full prompt cost for a synthetic usage log with cache tokens > 0', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.000002,
        completionTokens: 0.000006,
        inputCacheReadTokens: 0.0000002,
        inputCacheWriteTokens: 0.0000025,
        request: 0,
      };

      const cachedPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createAmazonBedrockV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: Bedrock's Converse API surfaces cache-read/cache-write tokens alongside
      // `inputTokens` (not nested inside it), so `inputTokens` itself stays the full non-cache value.
      const resultWithCache = createResult({
        usage: {
          inputTokens: {
            total: 120,
            noCache: 80,
            cacheRead: 40,
            cacheWrite: 15,
          },
          outputTokens: {
            total: 20,
            text: 20,
            reasoning: 0,
          },
          raw: {
            inputTokens: 80,
            outputTokens: 20,
            totalTokens: 100,
            cacheReadInputTokens: 40,
            cacheWriteInputTokens: 15,
            serverToolUsage: {},
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'us.amazon.nova-lite-v1:0',
        provider: 'amazon-bedrock',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(80);
      expect(parsedEvent.usage.cacheReadTokens).toBe(40);
      expect(parsedEvent.usage.cacheWriteTokens).toBe(15);
      expect(parsedEvent.usage.outputTokens).toBe(20);
      expect(parsedEvent.usage.reasoningTokens).toBe(0);

      // Prompt (full, not reduced by cache): 80 * 0.000002 * 1e9 = 160,000 nanos
      // Cache read: 40 * 0.0000002 * 1e9 = 8,000 nanos
      // Cache write: 15 * 0.0000025 * 1e9 = 37,500 nanos
      // Completion: 20 * 0.000006 * 1e9 = 120,000 nanos
      // Total: 160,000 + 8,000 + 37,500 + 120,000 = 325,500 nanos
      expect(parsedEvent.cost?.amount).toBe(325500);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createAmazonBedrockV3Middleware({
        destinations: [destinationSpy],
        priceResolver: missingPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'unknown-model',
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

    it('should hit all fallback branches for full coverage (UUID generation, empty usage)', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAmazonBedrockV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult({
        response: { id: undefined },
        usage: {
          inputTokens: {
            total: undefined,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: undefined,
            text: undefined,
            reasoning: undefined,
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'us.amazon.nova-lite-v1:0',
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
        provider: 'amazon-bedrock',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
        },
        cost: { amount: 0, unit: 'nanos', currency: 'USD' },
        tags: {},
      });
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
      expect(parsedEmittedEvent!.generationId).toHaveLength(36);
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from stream finish chunk using the captured streamText usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAmazonBedrockV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // Captured `streamText` usage: inputTokens: 7, outputTokens: 251, totalTokens: 258, no cache,
      // providerMetadata null.
      const baseResult = createResult({
        usage: {
          inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 251, text: 251, reasoning: 0 },
          raw: {
            inputTokens: 7,
            outputTokens: 251,
            totalTokens: 258,
            serverToolUsage: {},
          },
        },
        providerMetadata: undefined,
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'us.amazon.nova-lite-v1:0',
        provider: 'amazon-bedrock',
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

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();
      expect(parsedEmittedEvent!.usage.inputTokens).toBe(7);
      expect(parsedEmittedEvent!.usage.outputTokens).toBe(251);
    });
  });
});
