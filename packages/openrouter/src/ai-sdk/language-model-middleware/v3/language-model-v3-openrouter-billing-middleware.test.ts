import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, test, vi } from 'vitest';
import {
  createOpenRouterV3Middleware,
  OpenRouterProviderMetadata,
} from './language-model-v3-openrouter-billing-middleware.js';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { AiBillingExtractorError } from '@ai-billing/core';
import {
  LanguageModelV3GenerateResult,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';

describe('OpenRouterBillingMiddlewareV3 Integration', () => {
  const realMetadata: OpenRouterProviderMetadata = {
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

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'Stockholm' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    response: { id: 'req-123', timestamp: new Date() },
    providerMetadata: {},
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract rich billing data and broadcast it with sub-provider info', async () => {
      const destinationSpy = vi.fn();
      const middleware = createOpenRouterV3Middleware({
        destinations: [destinationSpy],
      });

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });
      const mockModel = new MockLanguageModelV3({
        doGenerate: baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of Sweden?' });

      expect(destinationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: baseResult.response?.id,
          modelId: mockModel.modelId,
          provider: mockModel.provider,
          usage: {
            subProviderId: realMetadata.openrouter?.provider,
            inputTokens: realMetadata.openrouter?.usage?.promptTokens,
            outputTokens: realMetadata.openrouter?.usage?.completionTokens,
            cacheReadTokens:
              realMetadata.openrouter?.usage?.promptTokensDetails?.cachedTokens,
            reasoningTokens:
              realMetadata.openrouter?.usage?.completionTokensDetails
                ?.reasoningTokens,
            totalTokens: realMetadata.openrouter?.usage?.totalTokens,
            rawProviderCost: realMetadata.openrouter?.usage?.cost,
            rawUpstreamInferenceCost:
              realMetadata.openrouter?.usage?.costDetails
                ?.upstreamInferenceCost,
          },
          cost: {
            amount: realMetadata.openrouter?.usage?.cost,
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

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
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
      const result = streamText({ model: wrappedModel, prompt: 'Hi' });
      await result.text;

      await vi.waitFor(
        () => {
          expect(destinationSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              usage: {
                subProviderId: realMetadata.openrouter?.provider,
                inputTokens: realMetadata.openrouter?.usage?.promptTokens,
                outputTokens: realMetadata.openrouter?.usage?.completionTokens,
                cacheReadTokens:
                  realMetadata.openrouter?.usage?.promptTokensDetails
                    ?.cachedTokens,
                reasoningTokens:
                  realMetadata.openrouter?.usage?.completionTokensDetails
                    ?.reasoningTokens,
                totalTokens: realMetadata.openrouter?.usage?.totalTokens,
                rawProviderCost: realMetadata.openrouter?.usage?.cost,
                rawUpstreamInferenceCost:
                  realMetadata.openrouter?.usage?.costDetails
                    ?.upstreamInferenceCost,
              },
              cost: {
                amount: realMetadata.openrouter?.usage?.cost,
                unit: 'base',
                currency: 'USD',
              },
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

    const baseResult = createResult({
      providerMetadata: {
        openrouter: { usage: {} },
      } as SharedV3ProviderMetadata,
    });

    const mockModel = new MockLanguageModelV3({
      doGenerate: async () => baseResult,
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

    const baseResult = createResult({
      response: { id: undefined },
      providerMetadata: {
        openrouter: {
          provider: 'Google AI Studio',
          reasoning_details: [],
          usage: {
            //promptTokens: 7, - hits 0 fallback
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
      } as SharedV3ProviderMetadata,
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'test-model',
      provider: '', // Hits: model.provider || 'openrouter'
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    await vi.waitFor(() => expect(destinationSpy).toHaveBeenCalled());

    const event = destinationSpy.mock.calls?.[0]?.[0];
    expect(event.provider).toBe('openrouter');
    expect(event.usage.inputTokens).toBe(0);
    expect(event.generationId).toHaveLength(36); // UUID fallback
  });
});
