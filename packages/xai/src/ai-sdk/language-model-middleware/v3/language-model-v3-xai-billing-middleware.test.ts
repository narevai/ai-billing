import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createXaiV3Middleware,
  XaiUsageAccounting,
} from './language-model-v3-xai-billing-middleware.js';
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
      inputTokens: {
        total: 14,
        noCache: 9,
        cacheRead: 5,
        cacheWrite: 0,
      },
      outputTokens: {
        total: 254,
        text: 61,
        reasoning: 193,
      },
      raw: {
        prompt_tokens: 14,
        completion_tokens: 61,
        total_tokens: 268,
        prompt_tokens_details: {
          text_tokens: 14,
          audio_tokens: 0,
          image_tokens: 0,
          cached_tokens: 5,
        },
        completion_tokens_details: {
          reasoning_tokens: 193,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0,
        },
      } as XaiUsageAccounting,
    },
    response: { id: 'resp_xai_abc123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createXaiV3Middleware({
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
      const rawUsage = baseResult.usage.raw as XaiUsageAccounting;

      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: rawUsage.prompt_tokens,
          outputTokens:
            (rawUsage.total_tokens ?? 0) -
            (rawUsage.completion_tokens_details?.reasoning_tokens ?? 0),
          cacheReadTokens: rawUsage.prompt_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            rawUsage.completion_tokens_details?.reasoning_tokens ?? 0,
          totalTokens: rawUsage.total_tokens,
        },
        cost: {
          amount: 815500,
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

    it('should handle reasoning and cached tokens for grok-3-mini using actual logs', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.0000003,
        completionTokens: 0.0000005,
        inputCacheReadTokens: 0.000000075,
        request: 0,
      };

      const reasonerPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createXaiV3Middleware({
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
          raw: {
            prompt_tokens: 22,
            completion_tokens: 62,
            total_tokens: 289,
            prompt_tokens_details: {
              text_tokens: 18,
              audio_tokens: 0,
              image_tokens: 0,
              cached_tokens: 4,
            },
            completion_tokens_details: {
              reasoning_tokens: 227,
              audio_tokens: 0,
              accepted_prediction_tokens: 0,
              rejected_prediction_tokens: 0,
            },
          },
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
      expect(parsedEvent.usage.outputTokens).toBe(62);
      expect(parsedEvent.usage.reasoningTokens).toBe(227);

      expect(parsedEvent.cost?.amount).toBe(150200);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createXaiV3Middleware({
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
      const middleware = createXaiV3Middleware({
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
      const middleware = createXaiV3Middleware({
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
