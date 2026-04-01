import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenAICompatibleV3Middleware } from './language-model-v3-openai-compatible-billing-middleware.js';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import type { ModelPricing } from '@ai-billing/core';

describe('OpenAICompatibleBillingMiddlewareV3 Integration', () => {
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
    },
    response: { id: 'resp_0e07e75c3318ef', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract usage, resolve pricing, calculate cost, and broadcast event', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenAICompatibleV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
        providerId: 'groq',
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'llama-3.3-70b-versatile',
        provider: 'groq.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of France?' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'llama-3.3-70b-versatile',
        providerId: 'groq',
      });

      // Prompt: 13 * 0.0000002 * 1e9 = 2,600 nanos
      // Completion: 54 * 0.00000125 * 1e9 = 67,500 nanos
      // Total: 70,100 nanos
      expect(destinationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: baseResult.response?.id,
          modelId: 'llama-3.3-70b-versatile',
          provider: 'groq',
          usage: {
            inputTokens: 13,
            outputTokens: 54,
            cacheReadTokens: 0,
            reasoningTokens: 0,
            totalTokens: 67,
          },
          cost: {
            amount: 70100,
            unit: 'nanos',
            currency: 'USD',
          },
        }),
      );
    });

    it('should use providerId from options, not model.provider', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenAICompatibleV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
        providerId: 'together',
      });

      const baseResult = createResult();
      const mockModel = new MockLanguageModelV3({
        modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        provider: 'together.chat',
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      await generateText({ model: wrappedModel, prompt: 'Hi' });

      expect(mockPriceResolver).toHaveBeenCalledWith({
        modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        providerId: 'together',
      });

      const event = destinationSpy.mock.calls?.[0]?.[0];
      expect(event.provider).toBe('together');
    });
  });

  describe('wrapStream', () => {
    it('should extract usage and calculate cost correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenAICompatibleV3Middleware({
        destinations: [destinationSpy],
        priceResolver: mockPriceResolver,
        providerId: 'groq',
      });

      const baseResult = createResult();

      const mockModel = new MockLanguageModelV3({
        modelId: 'llama-3.3-70b-versatile',
        provider: 'groq.chat',
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

      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              generationId: baseResult.response?.id,
              modelId: 'llama-3.3-70b-versatile',
              provider: 'groq',
              usage: {
                inputTokens: 13,
                outputTokens: 54,
                cacheReadTokens: 0,
                reasoningTokens: 0,
                totalTokens: 67,
              },
              cost: expect.objectContaining({
                unit: 'nanos',
                currency: 'USD',
              }),
            }),
          );
        },
        { timeout: 500 },
      );
    });
  });

  it('should use outputTokens.total not outputTokens.text when reasoning tokens exceed total', async () => {
    const destinationSpy = vi.fn();
    const middleware = createOpenAICompatibleV3Middleware({
      destinations: [destinationSpy],
      priceResolver: mockPriceResolver,
      providerId: 'github-models',
    });

    // Simulates grok-3-mini: completion_tokens=3, reasoning_tokens=144
    // AI SDK computes text = total - reasoning = 3 - 144 = -141 (wrong)
    const baseResult = createResult({
      usage: {
        inputTokens: { total: 17, noCache: 17, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 3, text: -141, reasoning: 144 },
      },
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'xai/grok-3-mini',
      provider: 'github-models.chat',
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    const event = destinationSpy.mock.calls?.[0]?.[0];
    expect(event.usage.outputTokens).toBe(3);
    expect(event.usage.reasoningTokens).toBe(144);
    expect(event.usage.totalTokens).toBe(20); // 17 + 3
    expect(event.cost.amount).toBeGreaterThan(0);
  });

  it('should omit the cost object entirely if pricing resolves to undefined', async () => {
    const destinationSpy = vi.fn();
    const missingPriceResolver = vi.fn().mockResolvedValue(undefined);

    const middleware = createOpenAICompatibleV3Middleware({
      destinations: [destinationSpy],
      priceResolver: missingPriceResolver,
      providerId: 'groq',
    });

    const baseResult = createResult();
    const mockModel = new MockLanguageModelV3({
      modelId: 'unknown-future-model',
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hello' });

    const event = destinationSpy.mock.calls?.[0]?.[0];
    expect(event.usage.inputTokens).toBe(13);
    expect(event.usage.outputTokens).toBe(54);
    expect(event).not.toHaveProperty('cost');
  });

  it('should hit all fallback branches for full coverage (UUID generation, empty usage)', async () => {
    const destinationSpy = vi.fn();
    const middleware = createOpenAICompatibleV3Middleware({
      destinations: [destinationSpy],
      priceResolver: mockPriceResolver,
      providerId: 'groq',
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
      modelId: 'llama-3.3-70b-versatile',
      provider: 'groq.chat',
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    await vi.waitFor(() => expect(destinationSpy).toHaveBeenCalled());

    const event = destinationSpy.mock.calls?.[0]?.[0];

    expect(event.provider).toBe('groq');
    expect(event.usage.inputTokens).toBe(0);
    expect(event.usage.outputTokens).toBe(0);
    expect(event.usage.cacheReadTokens).toBe(0);
    expect(event.usage.reasoningTokens).toBe(0);
    expect(event.usage.totalTokens).toBe(0);
    expect(event.cost).toEqual({ amount: 0, unit: 'nanos', currency: 'USD' });
    expect(event.generationId).toHaveLength(36);
  });
});
