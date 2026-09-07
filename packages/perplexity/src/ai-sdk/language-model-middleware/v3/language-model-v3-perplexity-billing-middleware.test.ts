import { generateText, streamText, wrapLanguageModel } from 'ai-v6';
import { describe, expect, it, vi } from 'vitest';
import {
  createPerplexityV3Middleware,
  PerplexityV3UsageAccounting,
} from './language-model-v3-perplexity-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/types';
import { z } from 'zod';

describe('PerplexityBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const mockPricing: ModelPricing = {
    promptTokens: 0.000001,
    completionTokens: 0.000003,
    request: 0.000006,
  };

  const mockPriceResolver = vi.fn().mockResolvedValue(mockPricing);

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'Stockholm is the capital of Sweden.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    // Sample usage as returned by the dev-sandbox's `POST /api/raw/perplexity/generate-text`
    // route (via `@ai-sdk/perplexity`'s `createPerplexity()`), model `sonar-pro`, prompt
    // "What is the capital of Sweden?".
    usage: {
      inputTokens: {
        total: 7,
        noCache: 7,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 19,
        text: 19,
        reasoning: 0,
      },
      raw: {
        prompt_tokens: 7,
        completion_tokens: 19,
        total_tokens: 26,
        cost: {
          input_tokens_cost: 0.00002,
          output_tokens_cost: 0.00029,
          request_cost: 0.006,
          total_cost: 0.00631,
        },
      } as PerplexityV3UsageAccounting,
    },
    response: { id: 'resp_perplexity_abc123', timestamp: new Date() },
    providerMetadata: {
      perplexity: {
        usage: { citationTokens: null, numSearchQueries: null },
        cost: {
          inputTokensCost: 0.00002,
          outputTokensCost: 0.00029,
          requestCost: 0.006,
          totalCost: 0.00631,
        },
      },
    },
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event using the captured generate-text sample', async () => {
      const destinationSpy = vi.fn();
      const middleware = createPerplexityV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'sonar-pro',
        provider: 'perplexity.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'sonar-pro',
        providerId: 'perplexity',
      });

      // prompt: 0.000001 * 1e9 * 7 = 7,000 nanos
      // completion: 0.000003 * 1e9 * 19 = 57,000 nanos
      // request (flat): 0.000006 * 1e9 = 6,000 nanos
      // Total: 7,000 + 57,000 + 6,000 = 70,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: 'perplexity',
        usage: {
          inputTokens: 7,
          outputTokens: 19,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
          webSearchCount: 0,
        },
        cost: {
          amount: 70000,
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

    it('should count source content parts (citations) and pass webSearchCount through to the emitted event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createPerplexityV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const resultWithSources = createResult({
        content: [
          { type: 'text', text: 'Stockholm is the capital of Sweden.' },
          {
            type: 'source',
            sourceType: 'url',
            id: 'src-1',
            url: 'https://en.wikipedia.org/wiki/Stockholm',
          },
          {
            type: 'source',
            sourceType: 'url',
            id: 'src-2',
            url: 'https://en.wikipedia.org/wiki/Sweden',
          },
        ],
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'sonar-pro',
        provider: 'perplexity.chat',
        doGenerate: async () => resultWithSources,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.webSearchCount).toBe(2);
    });

    it('should price non-zero reasoning tokens (sonar-reasoning-pro / sonar-deep-research style usage)', async () => {
      const reasoningPricing: ModelPricing = {
        promptTokens: 0.000001,
        completionTokens: 0.000003,
        internalReasoningTokens: 0.000008,
        request: 0,
      };
      const reasoningPriceResolver = vi
        .fn()
        .mockResolvedValue(reasoningPricing);

      const destinationSpy = vi.fn();
      const middleware = createPerplexityV3Middleware({
        destinations: [destinationSpy],
        priceResolver: reasoningPriceResolver,
      });

      const resultWithReasoning = createResult({
        usage: {
          inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 44, text: 19, reasoning: 25 },
          raw: {
            prompt_tokens: 7,
            completion_tokens: 19,
            total_tokens: 51,
            reasoning_tokens: 25,
          } as PerplexityV3UsageAccounting,
        },
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'sonar-reasoning-pro',
        provider: 'perplexity.chat',
        doGenerate: async () => resultWithReasoning,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({
        model: wrappedModel,
        prompt: 'What is the capital of Sweden?',
      });

      const emittedPayload = destinationSpy.mock.calls[0]![0];
      const parsedEvent = StrictBillingEventSchema.parse(emittedPayload);

      expect(parsedEvent.usage.reasoningTokens).toBe(25);

      // prompt: 0.000001 * 1e9 * 7 = 7,000 nanos
      // completion: 0.000003 * 1e9 * 19 = 57,000 nanos
      // reasoning: 0.000008 * 1e9 * 25 = 200,000 nanos
      // Total: 7,000 + 57,000 + 200,000 = 264,000 nanos
      expect(parsedEvent.cost?.amount).toBe(264000);
      expect(parsedEvent.cost?.unit).toBe('nanos');
    });

    it('should omit the cost object entirely if pricing resolves to undefined', async () => {
      const destinationSpy = vi.fn();
      const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

      const middleware = createPerplexityV3Middleware({
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
      const middleware = createPerplexityV3Middleware({
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
        modelId: 'sonar-pro',
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
        provider: 'perplexity',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: { amount: 6000, unit: 'nanos', currency: 'USD' },
        tags: {},
      });
      expect(parsedEmittedEvent!).toMatchObject(expectedEvent);
      expect(parsedEmittedEvent!.generationId).toHaveLength(36);
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost from the stream finish chunk using the captured generate-text sample', async () => {
      const destinationSpy = vi.fn();
      const middleware = createPerplexityV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'sonar-pro',
        provider: 'perplexity.chat',
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
      let parsedEmittedEvent: BillingEvent;
      expect(() => {
        parsedEmittedEvent = StrictBillingEventSchema.parse(emittedPayload);
      }).not.toThrow();

      // Same expected cost as the equivalent `wrapGenerate` case above.
      expect(parsedEmittedEvent!.usage).toMatchObject({
        inputTokens: 7,
        outputTokens: 19,
        reasoningTokens: 0,
      });
      expect(parsedEmittedEvent!.cost?.amount).toBe(70000);
    });
  });
});
