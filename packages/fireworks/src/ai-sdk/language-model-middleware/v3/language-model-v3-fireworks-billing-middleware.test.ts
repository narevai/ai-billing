import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createFireworksV3Middleware,
  FireworksV3UsageAccounting,
} from './language-model-v3-fireworks-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('FireworksBillingMiddlewareV3 Integration', () => {
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
        total: 19,
        noCache: 19,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 158,
        text: 39,
        reasoning: 119,
      },
      // Sample raw usage as captured from the dev-sandbox's
      // `POST /api/raw/fireworks/generate-text` route (via `@ai-sdk/fireworks`'s `createFireworks()`).
      // Fireworks duplicates the reasoning-token count under both `completion_tokens_details` and
      // `output_tokens_details` — the middleware must read exactly one of them, never sum both.
      raw: {
        prompt_tokens: 19,
        completion_tokens: 158,
        total_tokens: 177,
        prompt_tokens_details: {
          cached_tokens: 0,
        },
        completion_tokens_details: {
          reasoning_tokens: 119,
        },
        output_tokens_details: {
          reasoning_tokens: 119,
        },
      } as FireworksV3UsageAccounting,
    },
    response: { id: 'resp_fireworks_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured generate-text usage from the issue', async () => {
      const destinationSpy = vi.fn();
      const middleware = createFireworksV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'accounts/fireworks/models/glm-5p3-flash',
        provider: 'fireworks.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'Say hello in one short sentence.',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'accounts/fireworks/models/glm-5p3-flash',
        providerId: 'fireworks',
      });
      const rawUsage = baseResult.usage.raw as FireworksV3UsageAccounting;

      // prompt: 0.000001 * 1e9 * (19 - 0) = 19,000 nanos
      // completion (text-only): 0.000003 * 1e9 * (158 - 119) = 117,000 nanos
      // reasoning (billed at the completion rate, read once from completion_tokens_details, not summed
      // with the duplicate output_tokens_details value): 0.000003 * 1e9 * 119 = 357,000 nanos
      // Total: 19,000 + 117,000 + 357,000 = 493,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'fireworks',
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens: rawUsage.completion_tokens,
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 493000,
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
      const middleware = createFireworksV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: cached_tokens > 0, no completion_tokens_details or output_tokens_details at all
      // (both fields absent, not just their reasoning_tokens sub-fields), to exercise the
      // optional-chaining default to 0.
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
        modelId: 'accounts/fireworks/models/deepseek-v3',
        provider: 'fireworks.chat',
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

    it('should read reasoning tokens from output_tokens_details when completion_tokens_details is absent, without double-counting', async () => {
      const destinationSpy = vi.fn();
      const middleware = createFireworksV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // Synthetic, based on the issue's streamText capture: only `output_tokens_details.reasoning_tokens`
      // is present (no `completion_tokens_details` at all). If the middleware ever summed both fields
      // instead of reading exactly one, `usage.reasoningTokens` would report double the true value.
      const resultWithOutputDetailsOnly = createResult({
        usage: {
          inputTokens: {
            total: 19,
            noCache: 19,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 82,
            text: 46,
            reasoning: 36,
          },
          raw: {
            prompt_tokens: 19,
            completion_tokens: 82,
            total_tokens: 101,
            prompt_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens_details: {
              reasoning_tokens: 36,
            },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'accounts/fireworks/models/glm-5p3-flash',
        provider: 'fireworks.chat',
        doGenerate: async () => resultWithOutputDetailsOnly,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(19);
      expect(parsedEvent.usage.outputTokens).toBe(82);
      expect(parsedEvent.usage.cacheReadTokens).toBe(0);
      // Must equal 36, the single captured value — never 72 (double-counted).
      expect(parsedEvent.usage.reasoningTokens).toBe(36);
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createFireworksV3Middleware({
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
      const middleware = createFireworksV3Middleware({
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
        modelId: 'accounts/fireworks/models/glm-5p3-flash',
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
        provider: 'fireworks',
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
      const middleware = createFireworksV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'accounts/fireworks/models/glm-5p3-flash',
        provider: 'fireworks.chat',
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
