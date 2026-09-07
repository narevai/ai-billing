import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createCerebrasV4Middleware,
  CerebrasV4UsageAccounting,
} from './language-model-v4-cerebras-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV4,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('CerebrasBillingMiddlewareV4 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.000001,
    completionTokens: 0.000003,
    inputCacheReadTokens: 0.0000005,
    request: 0,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV4GenerateResult> = {},
  ): LanguageModelV4GenerateResult => ({
    content: [{ type: 'text', text: 'The capital of Sweden is Stockholm.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: {
        total: 74,
        noCache: 74,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 72,
        text: 44,
        reasoning: 28,
      },
      // Actual raw usage captured from the dev-sandbox's `POST /api/raw/cerebras/generate-text`
      // route (via `@ai-sdk/cerebras`'s `createCerebras()`), using the `gpt-oss-120b` model
      // (see issue #290): prompt_tokens: 74, completion_tokens: 72 (of which 28 are reasoning
      // tokens), total_tokens: 146, cached_tokens: 0.
      raw: {
        prompt_tokens: 74,
        completion_tokens: 72,
        total_tokens: 146,
        prompt_tokens_details: {
          cached_tokens: 0,
        },
        completion_tokens_details: {
          reasoning_tokens: 28,
        },
      } as CerebrasV4UsageAccounting,
    },
    response: { id: 'resp_cerebras_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createCerebrasV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV4({
        modelId: 'gpt-oss-120b',
        provider: 'cerebras.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'gpt-oss-120b',
        providerId: 'cerebras',
      });
      const rawUsage = baseResult.usage.raw as CerebrasV4UsageAccounting;

      // prompt: 0.000001 * 1e9 * (74 - 0) = 74,000 nanos
      // completion (non-reasoning): 0.000003 * 1e9 * (72 - 28) = 132,000 nanos
      // reasoning: 0.000003 * 1e9 * 28 = 84,000 nanos
      // Total: 74,000 + 132,000 + 84,000 = 290,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'cerebras',
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens: rawUsage.completion_tokens,
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 290000,
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
      const middleware = createCerebrasV4Middleware({
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

      const mockModel = new MockLanguageModelV4({
        modelId: 'qwen-3.8-27b',
        provider: 'cerebras.chat',
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

      const middleware = createCerebrasV4Middleware({
        destinations: [destinationSpy],
        priceResolver: missingPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV4({
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
      const middleware = createCerebrasV4Middleware({
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

      const mockModel = new MockLanguageModelV4({
        modelId: 'gpt-oss-120b',
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
        provider: 'cerebras',
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
    it('should extract usage and calculate cost from the captured stream-text finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createCerebrasV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // Actual raw usage captured from the dev-sandbox's `POST /api/raw/cerebras/stream-text`
      // route (see issue #290): inputTokens: 74, outputTokens: 42 (of which 22 are reasoning
      // tokens), totalTokens: 116, cached_tokens: 0.
      const streamResult = createResult({
        usage: {
          inputTokens: {
            total: 74,
            noCache: 74,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 42,
            text: 20,
            reasoning: 22,
          },
          raw: {
            prompt_tokens: 74,
            completion_tokens: 42,
            total_tokens: 116,
            prompt_tokens_details: {
              cached_tokens: 0,
            },
            completion_tokens_details: {
              reasoning_tokens: 22,
            },
          } as CerebrasV4UsageAccounting,
        },
      });

      const mockModel = new MockLanguageModelV4({
        modelId: 'gpt-oss-120b',
        provider: 'cerebras.chat',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: streamResult.response!.id! },
            { type: 'text-start', id: streamResult.response!.id! },
            {
              type: 'finish',
              finishReason: streamResult.finishReason,
              usage: streamResult.usage,
              providerMetadata: streamResult.providerMetadata,
            },
          ]),
          response: streamResult.response,
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

      expect(parsedEmittedEvent!.usage.inputTokens).toBe(74);
      expect(parsedEmittedEvent!.usage.outputTokens).toBe(42);
      expect(parsedEmittedEvent!.usage.reasoningTokens).toBe(22);

      // prompt: 0.000001 * 1e9 * (74 - 0) = 74,000 nanos
      // completion (non-reasoning): 0.000003 * 1e9 * (42 - 22) = 60,000 nanos
      // reasoning: 0.000003 * 1e9 * 22 = 66,000 nanos
      // Total: 74,000 + 60,000 + 66,000 = 200,000 nanos
      expect(parsedEmittedEvent!.cost?.amount).toBe(200000);
      expect(parsedEmittedEvent!.cost?.unit).toBe('nanos');
    });
  });
});
