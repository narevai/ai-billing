import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createGroqV3Middleware } from './language-model-v3-groq-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/core';
import { z } from 'zod';

describe('GroqBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.0000002, // $0.20 per 1M
    completionTokens: 0.00000125, // $1.25 per 1M
    inputCacheReadTokens: 0.0000001,
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
        prompt_tokens_details: {
          cached_tokens: 0,
        },
        completion_tokens_details: {
          reasoning_tokens: 0,
        },
        total_time: 0.45,
      },
    },
    response: { id: 'resp_0e07e75c3318ef', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGroqV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'gpt-5',
        provider: 'groq',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of France?' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'gpt-5',
        providerId: 'groq',
      });

      // Calculate expected cost:
      // Prompt: 13 * 0.0000002 * 1e9 = 2,600 nanos
      // Completion: 54 * 0.00000125 * 1e9 = 67,500 nanos
      // Total: 70,100 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: 13,
          outputTokens: 54,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: {
          amount: 70100,
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
  });

  describe('reasoning tokens', () => {
    it('should handle reasoning tokens correctly', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGroqV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      // Mirrors the real openai/gpt-oss-120b response: 78 input, 19 text + 24 reasoning output
      const reasoningResult = createResult({
        usage: {
          inputTokens: { total: 78, noCache: 78, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 43, text: 19, reasoning: 24 },
          raw: {
            prompt_tokens: 78,
            completion_tokens: 43,
            total_tokens: 121,
            prompt_tokens_details: { cached_tokens: 0 },
            completion_tokens_details: { reasoning_tokens: 24 },
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'openai/gpt-oss-120b',
        provider: 'groq',
        doGenerate: async () => reasoningResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      // Prompt: 78 * 0.0000002 * 1e9 = 15,600 nanos
      // Completion: 43 * 0.00000125 * 1e9 = 53,750 nanos
      // Reasoning (no internalReasoningTokens rate): 0 nanos
      // Total: 69,350 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: reasoningResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: 78,
          outputTokens: 43,
          cacheReadTokens: 0,
          reasoningTokens: 24,
        },
        cost: { amount: 69350, unit: 'nanos', currency: 'USD' },
        tags: {},
      });

      expect(destinationSpy).toHaveBeenCalledTimes(1);
      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGroqV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'gpt-4o',
        provider: 'groq',
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
      const result = streamText({ model: wrappedModel, prompt: 'Hello' });
      await result.text;

      // 1. Wait for the middleware to broadcast
      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledTimes(1);
        },
        { timeout: 500 },
      );

      // 2. Define expected valid data
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: 13,
          outputTokens: 54,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: {
          amount: 70100, // 13 * 0.2 + 54 * 1.25 = 70.1 micro-cents -> 70100 nanos
          unit: 'nanos',
          currency: 'USD',
        },
        tags: {},
      });

      // 3. Extract, validate, and compare actual data
      const emittedPayload = destinationSpy.mock.calls[0]![0];
      let parsedEmittedEvent: BillingEvent;

      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();

      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
    });
  });

  it('should omit the cost object entirely if pricing resolves to undefined', async () => {
    const destinationSpy = vi.fn();
    const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

    const middleware = createGroqV3Middleware({
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
      provider: 'groq',
      usage: {
        inputTokens: 13,
        outputTokens: 54,
        cacheReadTokens: 0,
        reasoningTokens: 0,
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
    const middleware = createGroqV3Middleware({
      destinations: [destinationSpy],
      priceResolver: mockPriceResolver,
    });

    const baseResult = createResult({
      response: { id: undefined }, // Forces UUID generation
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
      modelId: 'gpt-3.5-turbo',
      provider: '', // Forces provider fallback
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
      generationId: parsedEmittedEvent!.generationId, // Inject the random UUID
      modelId: mockModel.modelId,
      provider: 'groq',
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
