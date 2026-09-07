import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createAzureV3Middleware,
  AzureV3UsageAccounting,
} from './language-model-v3-azure-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('AzureBillingMiddlewareV3 Integration', () => {
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
    content: [
      { type: 'text', text: 'The capital of Sweden is **Stockholm**.' },
    ],
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
        total: 10,
        text: 10,
        reasoning: 0,
      },
      // Sample raw usage as captured against the dev-sandbox's
      // `POST /api/raw/azure/generate-text` route (Azure AI Foundry, routed through the Responses API).
      raw: {
        input_tokens: 17,
        input_tokens_details: {
          cached_tokens: 0,
          cache_write_tokens: 0,
        },
        output_tokens: 10,
        output_tokens_details: {
          reasoning_tokens: 0,
        },
        service_tier: 'auto',
      } as AzureV3UsageAccounting,
    },
    response: {
      id: 'resp_08de815cb46c05dd006a9e5fe9abd48196a625eb6c44cb1d69',
      timestamp: new Date(),
    },
    providerMetadata: {
      azure: {
        responseId: 'resp_08de815cb46c05dd006a9e5fe9abd48196a625eb6c44cb1d69',
        serviceTier: 'auto',
      },
    },
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the sample generate-text usage', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'DeepSeek-V4-Pro',
        provider: 'azure.responses',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'DeepSeek-V4-Pro',
        providerId: 'azure',
      });
      const rawUsage = baseResult.usage.raw as AzureV3UsageAccounting;

      // prompt: 0.000001 * 1e9 * (17 - 0 - 0) = 17,000 nanos
      // completion: 0.000003 * 1e9 * (10 - 0) = 30,000 nanos
      // Total: 17,000 + 30,000 = 47,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'azure',
        usage: {
          inputTokens: rawUsage.input_tokens,
          outputTokens: rawUsage.output_tokens,
          cacheReadTokens: rawUsage.input_tokens_details?.cached_tokens ?? 0,
          cacheWriteTokens:
            rawUsage.input_tokens_details?.cache_write_tokens ?? 0,
          reasoningTokens:
            rawUsage.output_tokens_details?.reasoning_tokens ?? 0,
        },
        cost: {
          amount: 47000,
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

    it('should deduct cache-read and cache-write tokens from a synthetic usage log with cached_tokens > 0 and cache_write_tokens > 0', async () => {
      const actualPricing: ModelPricing = {
        promptTokens: 0.0000004,
        completionTokens: 0.0000012,
        inputCacheReadTokens: 0.0000001,
        inputCacheWriteTokens: 0.0000002,
        request: 0,
      };

      const cachedPriceResolver = vi.fn().mockResolvedValue(actualPricing);

      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: cachedPriceResolver,
      });

      // Synthetic: cached_tokens > 0 and cache_write_tokens > 0 (both subsets of input_tokens).
      const resultWithCache = createResult({
        usage: {
          inputTokens: {
            total: 100,
            noCache: 60,
            cacheRead: 30,
            cacheWrite: 10,
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
              cache_write_tokens: 10,
            },
            output_tokens: 40,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            service_tier: 'auto',
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'DeepSeek-V4-Pro',
        provider: 'azure.responses',
        doGenerate: async () => resultWithCache,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Summarize this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(100);
      expect(parsedEvent.usage.cacheReadTokens).toBe(30);
      expect(parsedEvent.usage.cacheWriteTokens).toBe(10);
      expect(parsedEvent.usage.outputTokens).toBe(40);
      expect(parsedEvent.usage.reasoningTokens).toBe(0);

      // prompt: 0.0000004 * 1e9 * (100 - 30 - 10) = 24,000 nanos
      // completion: 0.0000012 * 1e9 * (40 - 0) = 48,000 nanos
      // cacheRead: 0.0000001 * 1e9 * 30 = 3,000 nanos
      // cacheWrite: 0.0000002 * 1e9 * 10 = 2,000 nanos
      // Total: 24,000 + 48,000 + 3,000 + 2,000 = 77,000 nanos
      expect(parsedEvent.cost?.amount).toBe(77000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should deduct reasoning tokens from a synthetic usage log with reasoning_tokens > 0', async () => {
      const reasoningPricing: ModelPricing = {
        promptTokens: 0.0000003,
        completionTokens: 0.0000005,
        inputCacheReadTokens: 0.000000075,
        internalReasoningTokens: 0.0000008,
        request: 0,
      };

      const reasoningPriceResolver = vi
        .fn()
        .mockResolvedValue(reasoningPricing);

      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: reasoningPriceResolver,
      });

      // Synthetic: reasoning_tokens > 0 (subset of output_tokens, per the Responses API).
      const resultWithReasoning = createResult({
        usage: {
          inputTokens: {
            total: 22,
            noCache: 18,
            cacheRead: 4,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 289,
            text: 62,
            reasoning: 227,
          },
          raw: {
            input_tokens: 22,
            input_tokens_details: {
              cached_tokens: 4,
              cache_write_tokens: 0,
            },
            output_tokens: 289,
            output_tokens_details: {
              reasoning_tokens: 227,
            },
            service_tier: 'auto',
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'DeepSeek-V4-Pro',
        provider: 'azure.responses',
        doGenerate: async () => resultWithReasoning,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Think about this' });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(22);
      expect(parsedEvent.usage.outputTokens).toBe(289);
      expect(parsedEvent.usage.reasoningTokens).toBe(227);

      // prompt: 0.0000003 * 1e9 * (22 - 4) = 5,400 nanos
      // completion: 0.0000005 * 1e9 * (289 - 227) = 31,000 nanos
      // cacheRead: 0.000000075 * 1e9 * 4 = 300 nanos
      // reasoning: 0.0000008 * 1e9 * 227 = 181,600 nanos
      // Total: 5,400 + 31,000 + 300 + 181,600 = 218,300 nanos
      expect(parsedEvent.cost?.amount).toBe(218300);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: missingPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'unknown-deployment',
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

    it('should hit all fallback branches for full coverage (UUID generation, empty usage, no raw payload)', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
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
        modelId: 'DeepSeek-V4-Pro',
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
        provider: 'azure',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
        },
        cost: { amount: 0, unit: 'nanos', currency: 'USD' },
        tags: {},
      });
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
      expect(parsedEmittedEvent!.generationId).toHaveLength(36);
    });

    it('should fall back to normalized usage fields with non-zero cache-read, cache-write, and reasoning values when usage.raw is absent', async () => {
      const fallbackPricing: ModelPricing = {
        promptTokens: 0.0000003,
        completionTokens: 0.0000005,
        inputCacheReadTokens: 0.0000001,
        inputCacheWriteTokens: 0.0000002,
        internalReasoningTokens: 0.0000004,
        request: 0,
      };

      const fallbackPriceResolver = vi.fn().mockResolvedValue(fallbackPricing);

      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: fallbackPriceResolver,
      });

      // No `raw` payload (e.g. a provider/AI SDK version that doesn't surface it), so the middleware
      // must fall back to the normalized `usage.inputTokens`/`usage.outputTokens` fields, which here
      // carry non-zero cache-read, cache-write, and reasoning values.
      const baseResult = createResult({
        usage: {
          inputTokens: {
            total: 50,
            noCache: 32,
            cacheRead: 12,
            cacheWrite: 6,
          },
          outputTokens: {
            total: 80,
            text: 55,
            reasoning: 25,
          },
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'DeepSeek-V4-Pro',
        provider: 'azure.responses',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({
        model: wrappedModel,
        prompt: 'Fall back to normalized usage',
      });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.inputTokens).toBe(50);
      expect(parsedEvent.usage.outputTokens).toBe(80);
      expect(parsedEvent.usage.cacheReadTokens).toBe(12);
      expect(parsedEvent.usage.cacheWriteTokens).toBe(6);
      expect(parsedEvent.usage.reasoningTokens).toBe(25);

      // prompt: 0.0000003 * 1e9 * (50 - 12 - 6) = 9,600 nanos
      // completion: 0.0000005 * 1e9 * (80 - 25) = 27,500 nanos
      // cacheRead: 0.0000001 * 1e9 * 12 = 1,200 nanos
      // cacheWrite: 0.0000002 * 1e9 * 6 = 1,200 nanos
      // reasoning: 0.0000004 * 1e9 * 25 = 10,000 nanos
      // Total: 9,600 + 27,500 + 1,200 + 1,200 + 10,000 = 49,500 nanos
      expect(parsedEvent.cost?.amount).toBe(49500);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAzureV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'DeepSeek-V4-Pro',
        provider: 'azure.responses',
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
