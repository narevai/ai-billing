import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterV3Middleware } from './language-model-v3-openrouter-billing-middleware.js';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { AiBillingExtractorError } from '@ai-billing/core';

describe('OpenRouterBillingMiddlewareV3 Integration', () => {
  const realOpenRouterMetadata = {
    openrouter: {
      provider: 'Google AI Studio',
      reasoning_details: [],
      usage: {
        promptTokens: 7,
        promptTokensDetails: {
          cachedTokens: 0,
        },
        completionTokens: 10,
        completionTokensDetails: {
          reasoningTokens: 0,
        },
        totalTokens: 17,
        cost: 0.000004653,
        costDetails: {
          upstreamInferenceCost: 0.0000047,
        },
      },
    },
  };

  describe('wrapGenerate', () => {
    it('should extract rich billing data and broadcast it with sub-provider info', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenRouterV3Middleware({
        destinations: [destinationSpy],
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Stockholm' }],
          warnings: [],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 10, text: 10, reasoning: 0 },
          },
          response: { id: 'gen-1774748258' },
          providerMetadata: realOpenRouterMetadata,
        }),
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of Sweden?' });

      expect(destinationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: 'gen-1774748258',
          modelId: 'google/gemini-2.0-flash-001',
          provider: 'openrouter',
          usage: {
            subProviderId: 'Google AI Studio',
            inputTokens: 7,
            outputTokens: 10,
            cacheReadTokens: 0,
            reasoningTokens: 0,
            totalTokens: 17,
            rawProviderCost: 0.000004653,
            rawUpstreamInferenceCost: 0.0000047,
          },
          cost: {
            amount: 0.000004653,
            unit: 'base',
            currency: 'USD',
          },
        }),
      );
    });
  });

  describe('wrapStream', () => {
    it('should extract billing data correctly from stream finish chunk', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenRouterV3Middleware({
        destinations: [destinationSpy],
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: 'stream-123' },
            { type: 'text-start', id: 'stream-123' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: {
                  total: 7,
                  noCache: 7,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 10, text: 10, reasoning: 0 },
              },
              providerMetadata: realOpenRouterMetadata,
            },
          ]),
        }),
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
      const result = streamText({ model: wrappedModel, prompt: 'Hi' });
      await result.text;

      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              usage: expect.objectContaining({
                subProviderId: 'Google AI Studio',
                rawUpstreamInferenceCost: 0.0000047,
              }),
            }),
          );
        },
        { timeout: 500 },
      );
    });
  });

  it('should trigger onError when OpenRouter cost metadata is missing', async () => {
    const onErrorSpy = vi.fn();

    const middleware = createOpenRouterV3Middleware({
      destinations: [vi.fn()],
      onError: onErrorSpy,
    });

    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Stockholm' }],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        response: { id: 'req-123', timestamp: new Date() },
        providerMetadata: { openrouter: { usage: {} } }, // Triggers the extractor error
      }),
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

    await generateText({
      model: wrappedModel,
      prompt: 'Hello',
    });

    expect(onErrorSpy).toHaveBeenCalledTimes(1);

    const error = onErrorSpy.mock.calls?.[0]?.[0];
    expect(error).toBeInstanceOf(AiBillingExtractorError);
    expect(error.message).toContain(
      "Expected 'usage.cost' to be a valid number",
    );
  });

  it('should hit all fallback branches for full coverage', async () => {
    const destinationSpy = vi.fn();
    const middleware = createOpenRouterV3Middleware({
      destinations: [destinationSpy],
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'test-model',
      provider: '', // Hits: model.provider || 'openrouter'
      doGenerate: async () => ({
        content: [],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        response: { id: undefined }, // Hits: responseId ?? crypto.randomUUID()
        providerMetadata: {
          openrouter: {
            usage: {
              cost: 0.1,
              // Omit all token details to hit: ?? 0 branches
            },
          },
        },
      }),
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    await vi.waitFor(() => expect(destinationSpy).toHaveBeenCalled());

    const event = destinationSpy.mock.calls?.[0]?.[0];
    // Verify fallbacks worked
    expect(event.provider).toBe('openrouter');
    expect(event.usage.inputTokens).toBe(0);
    expect(event.generationId).toHaveLength(36); // UUID fallback
  });
});
