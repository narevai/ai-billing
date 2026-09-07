import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createAlibabaV3Middleware,
  AlibabaV3UsageAccounting,
} from './language-model-v3-alibaba-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('AlibabaBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.000001,
    completionTokens: 0.000003,
    inputCacheReadTokens: 0.0000005,
    request: 0,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'Hello there!' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: {
        total: 15,
        noCache: 15,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: 0,
      },
      // Sample raw usage as captured from the dev-sandbox's
      // `POST /api/raw/alibaba/generate-text` route (via `@ai-sdk/alibaba`'s `createAlibaba()`,
      // model: qwen-plus).
      raw: {
        prompt_tokens: 15,
        completion_tokens: 10,
        total_tokens: 25,
        service_tier: 'standard',
        prompt_tokens_details: {
          cached_tokens: 0,
        },
      } as AlibabaV3UsageAccounting,
    },
    response: { id: 'resp_alibaba_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the sample generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAlibabaV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'qwen-plus',
        provider: 'alibaba.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'Say hello in one short sentence.',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'qwen-plus',
        providerId: 'alibaba',
      });
      const rawUsage = baseResult.usage.raw as AlibabaV3UsageAccounting;

      // prompt: 0.000001 * 1e9 * (15 - 0) = 15,000 nanos
      // completion: 0.000003 * 1e9 * (10 - 0) = 30,000 nanos
      // Total: 15,000 + 30,000 = 45,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'alibaba',
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens: rawUsage.completion_tokens,
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 45000,
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
      const middleware = createAlibabaV3Middleware({
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
            service_tier: 'standard',
            prompt_tokens_details: {
              cached_tokens: 30,
            },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'qwen-turbo',
        provider: 'alibaba.chat',
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

    it('should deduct reasoning tokens from completion tokens for a Qwen thinking-mode usage log', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.0000008,
        completionTokens: 0.000002,
        inputCacheReadTokens: 0.0000002,
        request: 0,
      };

      const reasoningPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createAlibabaV3Middleware({
        destinations: [destinationSpy],
        priceResolver: reasoningPriceResolver,
      });

      // Synthetic: Qwen thinking mode enabled, so completion_tokens_details.reasoning_tokens > 0.
      const resultWithReasoning = createResult({
        usage: {
          inputTokens: {
            total: 20,
            noCache: 20,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 120,
            text: 45,
            reasoning: 75,
          },
          raw: {
            prompt_tokens: 20,
            completion_tokens: 120,
            total_tokens: 140,
            service_tier: 'standard',
            prompt_tokens_details: {
              cached_tokens: 0,
            },
            completion_tokens_details: {
              reasoning_tokens: 75,
            },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'qwen-plus',
        provider: 'alibaba.chat',
        doGenerate: async () => resultWithReasoning,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Think this through' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(20);
      expect(parsedEvent.usage.cacheReadTokens).toBe(0);
      expect(parsedEvent.usage.outputTokens).toBe(120);
      expect(parsedEvent.usage.reasoningTokens).toBe(75);

      // prompt: 0.0000008 * 1e9 * (20 - 0) = 16,000 nanos
      // completion: 0.000002 * 1e9 * (120 - 75) = 90,000 nanos
      // reasoning: 0.000002 * 1e9 * 75 = 150,000 nanos
      // Total: 16,000 + 90,000 + 150,000 = 256,000 nanos
      expect(parsedEvent.cost?.amount).toBe(256000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createAlibabaV3Middleware({
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
      const middleware = createAlibabaV3Middleware({
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
        modelId: 'qwen-plus',
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
        provider: 'alibaba',
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
      const middleware = createAlibabaV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'qwen-plus',
        provider: 'alibaba.chat',
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
        prompt: 'Say hello in one short sentence.',
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
