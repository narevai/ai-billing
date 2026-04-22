import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekV3Middleware } from './language-model-v3-deepseek-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/core';
import { z } from 'zod';

describe('DeepSeekBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.00000027, // $0.27/1M cache miss
    completionTokens: 0.0000011, // $1.10/1M
    inputCacheReadTokens: 0.00000007, // $0.07/1M cache hit
    inputCacheWriteTokens: 0,
    request: 0,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'Paris' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 13, noCache: 13, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 54, text: 54, reasoning: 0 },
      raw: {
        prompt_tokens: 13,
        completion_tokens: 54,
        total_tokens: 67,
        prompt_cache_hit_tokens: 0,
        prompt_cache_miss_tokens: 13,
        completion_tokens_details: {
          reasoning_tokens: 0,
        },
      },
    },
    response: { id: 'resp_deepseek_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createDeepSeekV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'deepseek-chat',
        provider: 'deepseek',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of France?' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'deepseek-chat',
        providerId: 'deepseek',
      });

      // Prompt (non-cached): 13 * 270 = 3510 nanos
      // Completion: 54 * 1100 = 59400 nanos
      // Total: 62910 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: 13,
          outputTokens: 54,
          cacheReadTokens: 0,
          reasoningTokens: 0,
          totalTokens: 67,
        },
        cost: {
          amount: 62910,
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

    it('should handle cache hits and deduct them from prompt tokens', async () => {
      const destinationSpy = vi.fn();
      const middleware = createDeepSeekV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const resultWithCache = createResult({
        usage: {
          inputTokens: {
            total: 100,
            noCache: 60,
            cacheRead: 40,
            cacheWrite: 0,
          },
          outputTokens: { total: 30, text: 30, reasoning: 0 },
          raw: {
            prompt_tokens: 100,
            completion_tokens: 30,
            total_tokens: 130,
            prompt_cache_hit_tokens: 40,
            prompt_cache_miss_tokens: 60,
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'deepseek-chat',
        provider: 'deepseek',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'test' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      // Non-cached prompt: 60 tokens * 270 = 16200 nanos
      // Cache read: 40 tokens * 70 = 2800 nanos
      // Completion: 30 tokens * 1100 = 33000 nanos
      // Total: 52000 nanos
      expect(parsedEvent.usage.inputTokens).toBe(60);
      expect(parsedEvent.usage.cacheReadTokens).toBe(40);
      expect(parsedEvent.cost?.amount).toBe(52000);
    });

    it('should handle reasoning tokens for deepseek-reasoner', async () => {
      const reasonerPricing: ModelPricing = {
        promptTokens: 0.00000055,
        completionTokens: 0.00000219,
        inputCacheReadTokens: 0.00000014,
        inputCacheWriteTokens: 0,
        internalReasoningTokens: 0.00000219,
        request: 0,
      };
      const reasonerPriceResolver = vi.fn().mockResolvedValue(reasonerPricing);

      const destinationSpy = vi.fn();
      const middleware = createDeepSeekV3Middleware({
        destinations: [destinationSpy],
        priceResolver: reasonerPriceResolver,
      });

      const resultWithReasoning = createResult({
        usage: {
          inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 200, text: 80, reasoning: 120 },
          raw: {
            prompt_tokens: 50,
            completion_tokens: 200,
            total_tokens: 250,
            prompt_cache_hit_tokens: 0,
            prompt_cache_miss_tokens: 50,
            completion_tokens_details: { reasoning_tokens: 120 },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'deepseek-reasoner',
        provider: 'deepseek',
        doGenerate: async () => resultWithReasoning,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({
        model: wrappedModel,
        prompt: 'Solve this math problem',
      });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.outputTokens).toBe(80);
      expect(parsedEvent.usage.reasoningTokens).toBe(120);
    });
  });

  it('should omit the cost object entirely if pricing resolves to undefined', async () => {
    const destinationSpy = vi.fn();
    const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

    const middleware = createDeepSeekV3Middleware({
      destinations: [destinationSpy],
      priceResolver: missingPriceResolver,
    });

    const baseResult = createResult();
    const mockModel = new MockLanguageModelV3({
      modelId: 'unknown-future-model',
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hello' });

    const expectedEvent = StrictBillingEventSchema.parse({
      generationId: baseResult.response?.id,
      modelId: mockModel.modelId,
      provider: 'deepseek',
      usage: {
        inputTokens: 13,
        outputTokens: 54,
        cacheReadTokens: 0,
        reasoningTokens: 0,
        totalTokens: 67,
      },
      tags: {},
    });

    expect(destinationSpy).toHaveBeenCalledTimes(1);
    const emittedPayload = destinationSpy.mock.calls[0]![0];
    let parsedEmittedEvent: BillingEvent;
    expect(() => {
      parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
    }).not.toThrow();
    expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    expect(parsedEmittedEvent!).not.toHaveProperty('cost');
  });

  it('should hit all fallback branches for full coverage (UUID generation, empty usage)', async () => {
    const destinationSpy = vi.fn();
    const middleware = createDeepSeekV3Middleware({
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
        // raw intentionally omitted — covers the rawUsage = undefined path
      },
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'deepseek-chat',
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
      provider: 'deepseek',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      },
      cost: { amount: 0, unit: 'nanos', currency: 'USD' },
      tags: {},
    });
    expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    expect(parsedEmittedEvent!.generationId).toHaveLength(36);
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createDeepSeekV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'deepseek-chat',
        provider: 'deepseek',
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
        prompt: 'Capital of France?',
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
