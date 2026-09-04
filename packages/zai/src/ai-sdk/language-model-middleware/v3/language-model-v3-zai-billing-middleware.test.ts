import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createZaiV3Middleware,
  ZaiV3UsageAccounting,
} from './language-model-v3-zai-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('ZaiBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 1.4 / 1_000_000,
    completionTokens: 4.4 / 1_000_000,
    inputCacheReadTokens: 0.26 / 1_000_000,
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
        total: 19,
        noCache: 19,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 215,
        text: 42,
        reasoning: 173,
      },
      // Sample raw usage as returned by the dev-sandbox's
      // `POST /api/raw/zai/generate-text` route (via `@ai-sdk/zai`'s `createZai()`, model `glm-5.3`).
      raw: {
        prompt_tokens: 19,
        completion_tokens: 215,
        total_tokens: 234,
        prompt_tokens_details: {
          cached_tokens: 0,
        },
        completion_tokens_details: {
          reasoning_tokens: 173,
        },
      } as ZaiV3UsageAccounting,
    },
    response: { id: 'resp_zai_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createZaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'glm-5.3',
        provider: 'zai.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'glm-5.3',
        providerId: 'zai',
      });
      const rawUsage = baseResult.usage.raw as ZaiV3UsageAccounting;

      // prompt: 1.4/1e6 * 1e9 * (19 - 0) = 26,600 nanos
      // completion: 4.4/1e6 * 1e9 * (215 - 173) = 184,800 nanos
      // reasoning: 4.4/1e6 * 1e9 * 173 = 761,200 nanos
      // Total: 26,600 + 184,800 + 761,200 = 972,600 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'zai',
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens: rawUsage.completion_tokens,
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 972600,
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

    it('should deduct cache-read tokens from a synthetic usage log with cached_tokens > 0', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.0000004,
        completionTokens: 0.0000012,
        inputCacheReadTokens: 0.0000001,
        request: 0,
      };

      const cachedPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createZaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: cached_tokens > 0, no completion_tokens_details at all (field absent, not
      // just its reasoning_tokens sub-field), to exercise the optional-chaining default to 0.
      const resultWithCache = createResult({
        usage: {
          inputTokens: {
            total: 100,
            noCache: 70,
            cacheRead: 30,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 40,
            text: 40,
            reasoning: 0,
          },
          raw: {
            prompt_tokens: 100,
            completion_tokens: 40,
            total_tokens: 140,
            prompt_tokens_details: {
              cached_tokens: 30,
            },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'glm-5.3',
        provider: 'zai.chat',
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

      // prompt: 0.0000004 * 1e9 * (100 - 30) = 28,000 nanos
      // completion: 0.0000012 * 1e9 * (40 - 0) = 48,000 nanos
      // cacheRead: 0.0000001 * 1e9 * 30 = 3,000 nanos
      // Total: 28,000 + 48,000 + 3,000 = 79,000 nanos
      expect(parsedEvent.cost?.amount).toBe(79000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createZaiV3Middleware({
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
      const middleware = createZaiV3Middleware({
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
        modelId: 'glm-5.3',
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
        provider: 'zai',
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
      expect(parsedEmittedEvent!.generationId).toHaveLength(36);
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createZaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'glm-5.3',
        provider: 'zai.chat',
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
      expect(() =>
        StrictBillingEventSchema.parse(emittedPayload),
      ).not.toThrow();
    });
  });
});
