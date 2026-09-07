import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createDeepinfraV4Middleware,
  DeepinfraV4UsageAccounting,
} from './language-model-v4-deepinfra-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV4,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('DeepinfraBillingMiddlewareV4 Integration', () => {
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
    content: [{ type: 'text', text: 'Hello there!' }],
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
      // `POST /api/raw/deepinfra/generate-text` route (via `@ai-sdk/deepinfra`'s `createDeepInfra()`),
      // wrapping `meta-llama/Llama-3.3-70B-Instruct`.
      raw: {
        prompt_tokens: 17,
        completion_tokens: 8,
        total_tokens: 25,
        service_tier: 'standard',
        prompt_tokens_details: {
          cached_tokens: 0,
        },
        estimated_cost: 4.26e-6,
      } as DeepinfraV4UsageAccounting,
    },
    response: { id: 'resp_deepinfra_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the sample generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createDeepinfraV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.3-70B-Instruct',
        provider: 'deepinfra.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'Say hello in one short sentence.',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'meta-llama/Llama-3.3-70B-Instruct',
        providerId: 'deepinfra',
      });
      const rawUsage = baseResult.usage.raw as DeepinfraV4UsageAccounting;

      // prompt: 0.000001 * 1e9 * (17 - 0) = 17,000 nanos
      // completion: 0.000003 * 1e9 * (8 - 0) = 24,000 nanos
      // Total: 17,000 + 24,000 = 41,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'deepinfra',
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens: rawUsage.completion_tokens,
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
          rawProviderCost: rawUsage.estimated_cost,
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
      // estimated_cost is surfaced informationally only, never as the billed cost.
      expect(parsedEmittedEvent!.usage.rawProviderCost).toBe(4.26e-6);
      expect(parsedEmittedEvent!.cost?.amount).toBe(41000);
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
      const middleware = createDeepinfraV4Middleware({
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

      const mockModel = new MockLanguageModelV4({
        modelId: 'Qwen/Qwen2.5-72B-Instruct',
        provider: 'deepinfra.chat',
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
      expect(parsedEvent.usage.rawProviderCost).toBeUndefined();

      // prompt: 0.0000004 * 1e9 * (100 - 30) = 28,000 nanos
      // completion: 0.0000012 * 1e9 * (40 - 0) = 48,000 nanos
      // cacheRead: 0.0000001 * 1e9 * 30 = 3,000 nanos
      // Total: 28,000 + 48,000 + 3,000 = 79,000 nanos
      expect(parsedEvent.cost?.amount).toBe(79000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should default cacheReadTokens to 0 when prompt_tokens_details is explicitly null', async () => {
      const destinationSpy = vi.fn();
      const middleware = createDeepinfraV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // Some DeepInfra chat completions responses report `prompt_tokens_details: null` outright
      // (not just an absent field) on a cache miss; optional chaining must tolerate this.
      const resultWithNullDetails = createResult({
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
          raw: {
            prompt_tokens: 17,
            completion_tokens: 8,
            total_tokens: 25,
            service_tier: 'standard',
            prompt_tokens_details: null,
          },
        },
      });

      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.3-70B-Instruct',
        provider: 'deepinfra.chat',
        doGenerate: async () => resultWithNullDetails,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await expect(
        generateText({ model: wrappedModel, prompt: 'Hi' }),
      ).resolves.toBeDefined();

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.cacheReadTokens).toBe(0);
      expect(parsedEvent.usage.inputTokens).toBe(17);
      expect(parsedEvent.usage.outputTokens).toBe(8);
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createDeepinfraV4Middleware({
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
      const middleware = createDeepinfraV4Middleware({
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
        modelId: 'meta-llama/Llama-3.3-70B-Instruct',
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
        provider: 'deepinfra',
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
      const middleware = createDeepinfraV4Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV4({
        modelId: 'meta-llama/Llama-3.3-70B-Instruct',
        provider: 'deepinfra.chat',
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
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();
      expect(parsedEmittedEvent!.cost?.amount).toBe(41000);
      expect(parsedEmittedEvent!.usage.rawProviderCost).toBe(4.26e-6);
    });
  });
});
