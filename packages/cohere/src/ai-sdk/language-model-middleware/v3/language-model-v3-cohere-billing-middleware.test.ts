import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createCohereV3Middleware,
  CohereV3UsageAccounting,
} from './language-model-v3-cohere-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('CohereBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;

  // Cohere's public Command R (08-2024) pricing: $0.15 / 1M input, $0.60 / 1M output. No cache-read rate
  // is configured here on purpose -- this is the pricing shape used to prove the 192 cached tokens in the
  // captured payload do not inflate cost.
  const mockPricing: ModelPricing = {
    promptTokens: 0.15 / 1_000_000,
    completionTokens: 0.6 / 1_000_000,
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
        total: 207,
        noCache: 15,
        cacheRead: 192,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 8,
        text: 8,
        reasoning: 0,
      },
      // Captured raw usage from a real `generateText` call against `command-r-08-2024` (via
      // `@ai-sdk/cohere`'s `createCohere()`): 207 raw input tokens / 8 raw output tokens, but only 7/7
      // input/output tokens billed, with 192 input tokens served from Cohere's inference cache.
      raw: {
        billed_units: {
          input_tokens: 7,
          output_tokens: 7,
        },
        tokens: {
          input_tokens: 207,
          output_tokens: 8,
        },
        cached_tokens: 192,
      } as CohereV3UsageAccounting,
    },
    response: { id: 'resp_cohere_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should bill off billed_units (not the raw tokens.* totals) and not over-bill for cached tokens', async () => {
      const destinationSpy = vi.fn();
      const middleware = createCohereV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'command-r-08-2024',
        provider: 'cohere.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'Say hello in one short sentence.',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'command-r-08-2024',
        providerId: 'cohere',
      });

      // prompt: 0.15e-6 * 1e9 * 7 (billed_units.input_tokens) = 1,050 nanos
      // completion: 0.6e-6 * 1e9 * 7 (billed_units.output_tokens) = 4,200 nanos
      // cache read: 0 (inputCacheReadTokens unset) -- proves the 192 cached_tokens don't inflate cost
      // Total: 5,250 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'cohere',
        usage: {
          inputTokens: 7,
          outputTokens: 7,
          cacheReadTokens: 192,
          reasoningTokens: 0,
        },
        cost: {
          amount: 5250,
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

    it('should bill cache-read tokens as an opt-in line item when the resolved pricing sets inputCacheReadTokens', async () => {
      const cachePricing: ModelPricing = {
        promptTokens: 0.15 / 1_000_000,
        completionTokens: 0.6 / 1_000_000,
        inputCacheReadTokens: 0.0000001,
        request: 0,
      };
      const cachedPriceResolver = vi.fn().mockResolvedValue(cachePricing);

      const destinationSpy = vi.fn();
      const middleware = createCohereV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'command-r-08-2024',
        provider: 'cohere.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(7);
      expect(parsedEvent.usage.cacheReadTokens).toBe(192);
      expect(parsedEvent.usage.outputTokens).toBe(7);

      // prompt: 0.15e-6 * 1e9 * 7 = 1,050 nanos
      // completion: 0.6e-6 * 1e9 * 7 = 4,200 nanos
      // cache read: 0.0000001 * 1e9 * 192 = 19,200 nanos
      // Total: 1,050 + 4,200 + 19,200 = 24,450 nanos
      expect(parsedEvent.cost?.amount).toBe(24450);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should fall back to tokens.* when billed_units is absent from the raw payload', async () => {
      const destinationSpy = vi.fn();
      const middleware = createCohereV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const resultWithoutBilledUnits = createResult({
        usage: {
          inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
          raw: {
            tokens: {
              input_tokens: 50,
              output_tokens: 20,
            },
            cached_tokens: 0,
          } as CohereV3UsageAccounting,
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'command-r-08-2024',
        provider: 'cohere.chat',
        doGenerate: async () => resultWithoutBilledUnits,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Hi' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(50);
      expect(parsedEvent.usage.outputTokens).toBe(20);
      expect(parsedEvent.usage.cacheReadTokens).toBe(0);

      // prompt: 0.15e-6 * 1e9 * 50 = 7,500 nanos
      // completion: 0.6e-6 * 1e9 * 20 = 12,000 nanos
      // Total: 19,500 nanos
      expect(parsedEvent.cost?.amount).toBe(19500);
    });

    it('should NOT substitute raw tokens.* for an individual field when billed_units is present but partial/null', async () => {
      const destinationSpy = vi.fn();
      const middleware = createCohereV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // billed_units is present (not absent), but output_tokens is null and input_tokens is present at 5.
      // tokens.* carries much larger values (999/999) that must NOT be substituted for the null/0 field,
      // since the fallback to tokens.* is only supposed to trigger when billed_units itself is absent.
      const resultWithPartialBilledUnits = createResult({
        usage: {
          inputTokens: { total: 999, noCache: 999, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 999, text: 999, reasoning: 0 },
          raw: {
            billed_units: {
              input_tokens: 5,
              output_tokens: null,
            },
            tokens: {
              input_tokens: 999,
              output_tokens: 999,
            },
            cached_tokens: 0,
          } as CohereV3UsageAccounting,
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'command-r-08-2024',
        provider: 'cohere.chat',
        doGenerate: async () => resultWithPartialBilledUnits,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Hi' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      // input_tokens is taken from billed_units.input_tokens (5), not tokens.input_tokens (999).
      expect(parsedEvent.usage.inputTokens).toBe(5);
      // output_tokens is null within a *present* billed_units, so it resolves to 0 -- it must NOT fall
      // back to tokens.output_tokens (999), since billed_units as a whole is present.
      expect(parsedEvent.usage.outputTokens).toBe(0);

      // prompt: 0.15e-6 * 1e9 * 5 = 750 nanos
      // completion: 0.6e-6 * 1e9 * 0 = 0 nanos
      // Total: 750 nanos
      expect(parsedEvent.cost?.amount).toBe(750);
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createCohereV3Middleware({
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
      const middleware = createCohereV3Middleware({
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
        modelId: 'command-r-08-2024',
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
        provider: 'cohere',
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
      const middleware = createCohereV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'command-r-08-2024',
        provider: 'cohere.chat',
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
      expect(parsedEmittedEvent!.usage.inputTokens).toBe(7);
      expect(parsedEmittedEvent!.usage.cacheReadTokens).toBe(192);
    });
  });
});
