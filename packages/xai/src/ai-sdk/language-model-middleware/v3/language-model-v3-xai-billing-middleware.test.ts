import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createXAIV3Middleware } from './language-model-v3-xai-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/core';
import { z } from 'zod';

describe('XAIBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.000001,
    completionTokens: 0.000003,
    inputCacheReadTokens: 0.0000005,
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
      raw: {},
    },
    response: { id: 'resp_xai_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createXAIV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'grok-3',
        provider: 'xai',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of France?' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'grok-3',
        providerId: 'xai',
      });

      // Prompt: 0.000001 * 1e9 * 13 = 13,000 nanos
      // Completion: 0.000003 * 1e9 * 54 = 162,000 nanos
      // Total: 175,000 nanos
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
          amount: 175000,
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

    it('should pass inclusive token totals and calculate cached token cost accurately', async () => {
      const destinationSpy = vi.fn();
      const middleware = createXAIV3Middleware({
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
          raw: {},
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'grok-3',
        provider: 'xai',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'test' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      // Cost calculation internally deducts 40 from 100 base prompt tokens:
      // Prompt (non-cached): 0.000001 * 1e9 * (100 - 40) = 60,000 nanos
      // Cache read: 0.0000005 * 1e9 * 40 = 20,000 nanos
      // Completion: 0.000003 * 1e9 * 30 = 90,000 nanos
      // Total: 170,000 nanos

      // Middleware now emits the inclusive totals directly
      expect(parsedEvent.usage.inputTokens).toBe(100);
      expect(parsedEvent.usage.cacheReadTokens).toBe(40);
      expect(parsedEvent.cost?.amount).toBe(170000);
    });

    it('should handle reasoning and cached tokens for grok-3-mini using actual logs', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.0000003,
        completionTokens: 0.0000005,
        inputCacheReadTokens: 0.000000075,
        request: 0,
      };

      const reasonerPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createXAIV3Middleware({
        destinations: [destinationSpy],
        priceResolver: reasonerPriceResolver,
      });

      // Simulating the nested structure the AI SDK returns for these totals
      const resultWithReasoning = createResult({
        usage: {
          inputTokens: {
            total: 22,
            noCache: 18, // 22 total - 4 cached
            cacheRead: 4,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 289,
            text: 62, // 289 total - 227 reasoning
            reasoning: 227,
          },
          raw: {},
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'grok-3-mini',
        provider: 'xai',
        doGenerate: async () => resultWithReasoning,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Solve this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(22);
      expect(parsedEvent.usage.cacheReadTokens).toBe(4);
      expect(parsedEvent.usage.outputTokens).toBe(289);
      expect(parsedEvent.usage.reasoningTokens).toBe(227);

      expect(parsedEvent.cost?.amount).toBe(150200);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createXAIV3Middleware({
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
      const middleware = createXAIV3Middleware({
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
        modelId: 'grok-3',
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
        provider: 'xai',
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
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createXAIV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'grok-3',
        provider: 'xai',
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
