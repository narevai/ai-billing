import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createAnthropicV3Middleware } from './language-model-v3-anthropic-billing-middleware.js';
import {
  BillingEventSchema,
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { BillingEvent, ModelPricing } from '@ai-billing/core';
import { z } from 'zod';

describe('AnthropicBillingMiddlewareV3 Integration', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;

  // Real-world pricing derived from CSV data:
  // Prompt: $0.000072 / 24 tokens = $3.00 per 1M tokens
  // Completion: $0.00093 / 62 tokens = $15.00 per 1M tokens
  const mockPricing: ModelPricing = {
    promptTokens: 0.000003, // $3.00 per 1M
    completionTokens: 0.000015, // $15.00 per 1M
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
    finishReason: { unified: 'stop', raw: 'end_turn' },
    usage: {
      inputTokens: { total: 24, noCache: 24, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 62, text: 62, reasoning: 0 },
    },
    response: { id: 'resp_0e07e75c3318ef', timestamp: new Date() },
    providerMetadata: {
      anthropic: {
        usage: {
          input_tokens: 24,
          output_tokens: 62,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    },
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAnthropicV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'anthropic/claude-sonnet-4.6',
        provider: 'anthropic',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of France?' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'anthropic/claude-sonnet-4.6',
        providerId: 'anthropic',
      });

      // Calculate expected cost based on real-world payload:
      // Prompt: 24 * 0.000003 * 1e9 = 72,000 nanos
      // Completion: 62 * 0.000015 * 1e9 = 930,000 nanos
      // Total: 1,002,000 nanos
      const expectedEvent = StrictBillingEventSchema.parse({
        generationId: baseResult.response?.id,
        modelId: mockModel.modelId,
        provider: mockModel.provider,
        usage: {
          inputTokens: 24,
          outputTokens: 62,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: {
          amount: 1002000,
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

  describe('wrapStream', () => {
    it('should extract usage and calculate cost correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createAnthropicV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'anthropic/claude-sonnet-4.6',
        provider: 'anthropic',
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
          inputTokens: 24,
          outputTokens: 62,
          cacheReadTokens: 0,
          reasoningTokens: 0,
        },
        cost: {
          amount: 1002000, // 24 * 3.0 + 62 * 15.0 = 1002 micro-cents -> 1002000 nanos
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

    const middleware = createAnthropicV3Middleware({
      destinations: [destinationSpy],
      priceResolver: missingPriceResolver,
    });

    const baseResult = createResult();
    const mockModel = new MockLanguageModelV3({
      modelId: 'unknown-future-model',
      provider: 'anthropic',
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

    await generateText({ model: wrappedModel, prompt: 'Hello' });

    const expectedEvent = StrictBillingEventSchema.parse({
      generationId: baseResult.response?.id,
      modelId: mockModel.modelId,
      provider: 'anthropic',
      usage: {
        inputTokens: 24,
        outputTokens: 62,
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
    const middleware = createAnthropicV3Middleware({
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
      // No anthropic.usage — forces fallback to usage.inputTokens/outputTokens (which are also undefined → 0)
      providerMetadata: {
        anthropic: {},
      },
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'anthropic/claude-sonnet-4.6',
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
      generationId: parsedEmittedEvent!.generationId,
      modelId: mockModel.modelId,
      provider: 'anthropic',
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
