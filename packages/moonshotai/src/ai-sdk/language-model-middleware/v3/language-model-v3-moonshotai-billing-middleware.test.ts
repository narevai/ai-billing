import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createMoonshotaiV3Middleware,
  MoonshotaiV3UsageAccounting,
} from './language-model-v3-moonshotai-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('MoonshotaiBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 3.0 / 1_000_000,
    completionTokens: 15.0 / 1_000_000,
    inputCacheReadTokens: 0.3 / 1_000_000,
    internalReasoningTokens: 15.0 / 1_000_000,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [
      { type: 'reasoning', text: 'Thinking about Sweden...' },
      { type: 'text', text: 'The capital of Sweden is Stockholm.' },
    ],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: {
        total: 92,
        noCache: 92,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 369,
        text: 72,
        reasoning: 297,
      },
      // Sample raw usage as returned by the dev-sandbox's
      // `POST /api/raw/moonshotai/generate-text` route (via `@ai-sdk/moonshotai`'s `createMoonshotAI()`,
      // model `kimi-k3`).
      raw: {
        prompt_tokens: 92,
        completion_tokens: 369,
        total_tokens: 461,
        completion_tokens_details: {
          reasoning_tokens: 297,
        },
      } as MoonshotaiV3UsageAccounting,
    },
    response: { id: 'resp_moonshotai_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, split reasoning tokens out of completion tokens, resolve pricing, calculate cost, and broadcast event using the captured kimi-k3 generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createMoonshotaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'kimi-k3',
        provider: 'moonshotai.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'kimi-k3',
        providerId: 'moonshotai',
      });

      // prompt: (3.0 / 1e6) * 1e9 * (92 - 0) = 276,000 nanos
      // completion (text-only, 369 - 297 = 72): (15.0 / 1e6) * 1e9 * 72 = 1,080,000 nanos
      // reasoning (297): (15.0 / 1e6) * 1e9 * 297 = 4,455,000 nanos
      // Total: 276,000 + 1,080,000 + 4,455,000 = 5,811,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'moonshotai',
        usage: {
          inputTokens: 92,
          outputTokens: 72,
          cacheReadTokens: 0,
          reasoningTokens: 297,
        },
        cost: {
          amount: 5811000,
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
      // The AI SDK's own `outputTokens` for the raw payload total is 369 (including reasoning); assert
      // the emitted billing event does *not* use that total, avoiding double-billing reasoning tokens.
      expect(parsedEmittedEvent!.usage.outputTokens).not.toBe(369);
    });

    it('should read cache tokens from a top-level cached_tokens field when prompt_tokens_details is absent', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 3.0 / 1_000_000,
        completionTokens: 15.0 / 1_000_000,
        inputCacheReadTokens: 0.3 / 1_000_000,
        internalReasoningTokens: 15.0 / 1_000_000,
      };

      const cachedPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createMoonshotaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: top-level cached_tokens > 0, no prompt_tokens_details at all, and no reasoning.
      const resultWithCache = createResult({
        content: [{ type: 'text', text: 'Stockholm.' }],
        usage: {
          inputTokens: {
            total: 1000,
            noCache: 600,
            cacheRead: 400,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 20,
            text: 20,
            reasoning: 0,
          },
          raw: {
            prompt_tokens: 1000,
            completion_tokens: 20,
            total_tokens: 1020,
            cached_tokens: 400,
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'kimi-k3',
        provider: 'moonshotai.chat',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(1000);
      expect(parsedEvent.usage.cacheReadTokens).toBe(400);
      expect(parsedEvent.usage.outputTokens).toBe(20);
      expect(parsedEvent.usage.reasoningTokens).toBe(0);

      // Prompt (non-cached): (1000 - 400) * (3.0 / 1e6) * 1e9 = 1,800,000 nanos
      // Cache read: 400 * (0.3 / 1e6) * 1e9 = 120,000 nanos
      // Completion: 20 * (15.0 / 1e6) * 1e9 = 300,000 nanos
      // Total: 1,800,000 + 120,000 + 300,000 = 2,220,000 nanos
      expect(parsedEvent.cost?.amount).toBe(2220000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createMoonshotaiV3Middleware({
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
      const middleware = createMoonshotaiV3Middleware({
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
        modelId: 'kimi-k3',
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
        provider: 'moonshotai',
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
      const middleware = createMoonshotaiV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'kimi-k3',
        provider: 'moonshotai.chat',
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
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);
      expect(parsedEvent.usage.outputTokens).toBe(72);
      expect(parsedEvent.usage.reasoningTokens).toBe(297);
    });
  });
});
