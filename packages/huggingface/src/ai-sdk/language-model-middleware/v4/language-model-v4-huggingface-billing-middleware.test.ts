import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createHuggingfaceV4Middleware,
  HuggingfaceV4UsageAccounting,
} from './language-model-v4-huggingface-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV4,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('HuggingfaceBillingMiddlewareV4 Integration', () => {
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
        total: 17,
        noCache: 17,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 8,
        text: 8,
        reasoning: 0,
      },
      // Sample raw usage as returned by the dev-sandbox's
      // `POST /api/raw/huggingface/generate-text` route (via `@ai-sdk/huggingface`'s `createHuggingFace()`),
      // matching the captured `generateText` payload from GitHub issue #299.
      raw: {
        input_tokens: 17,
        input_tokens_details: {
          cached_tokens: 0,
        },
        output_tokens: 8,
        output_tokens_details: {
          reasoning_tokens: 0,
        },
        total_tokens: 25,
      } as HuggingfaceV4UsageAccounting,
    },
    response: {
      id: 'resp_12fe77a7f89238864926b0941725f33d1bb82466c777b3b2',
      timestamp: new Date(),
    },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the sample generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createHuggingfaceV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'huggingface.responses',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'meta-llama/Llama-3.1-8B-Instruct',
        providerId: 'huggingface',
      });
      const rawUsage = baseResult.usage.raw as HuggingfaceV4UsageAccounting;

      // prompt: 0.000001 * 1e9 * (17 - 0) = 17,000 nanos
      // completion: 0.000003 * 1e9 * (8 - 0) = 24,000 nanos
      // Total: 17,000 + 24,000 = 41,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'huggingface',
        usage: {
          inputTokens: rawUsage.input_tokens,
          outputTokens: rawUsage.output_tokens,
          cacheReadTokens: rawUsage.input_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.output_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 41000,
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
      const middleware = createHuggingfaceV4Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: cached_tokens > 0, no output_tokens_details at all (field absent, not
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
            input_tokens: 100,
            input_tokens_details: {
              cached_tokens: 30,
            },
            output_tokens: 40,
            total_tokens: 140,
          },
        },
      });

      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'huggingface.responses',
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

      const middleware = createHuggingfaceV4Middleware({
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
      const middleware = createHuggingfaceV4Middleware({
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
        modelId: 'meta-llama/Llama-3.1-8B-Instruct',
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
        provider: 'huggingface',
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
      const middleware = createHuggingfaceV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'huggingface.responses',
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
