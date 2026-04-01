import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import {
  createGatewayV3Middleware,
  GatewayProviderMetadata,
} from './language-model-v3-ai-gateway-billing-middleware.js';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { AiBillingExtractorError } from '@ai-billing/core';
import {
  LanguageModelV3GenerateResult,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';

describe('GatewayBillingMiddlewareV3 Integration', () => {
  const realMetadata: GatewayProviderMetadata = {
    gateway: {
      generationId: 'gen_01KN3XTWSNX1KQQJC782ADWPCJ',
      cost: '0',
      marketCost: '0.00096',
      enabledZeroDataRetention: false,
      enabledDisallowPromptTraining: false,
      routing: {
        originalModelId: 'anthropic/claude-opus-4',
        resolvedProvider: 'anthropic',
        resolvedProviderApiModelId: 'claude-opus-4-20250514',
        internalResolvedModelId: 'anthropic:claude-opus-4-20250514',
        fallbacksAvailable: ['vertexAnthropic', 'bedrock'],
        internalReasoning:
          'Selected anthropic as preferred provider for claude-opus-4.',
        planningReasoning: 'BYOK credentials available for: anthropic.',
        canonicalSlug: 'anthropic/claude-opus-4',
        finalProvider: 'anthropic',
        attempts: [
          {
            provider: 'anthropic',
            internalModelId: 'anthropic:claude-opus-4-20250514',
            providerApiModelId: 'claude-opus-4-20250514',
            credentialType: 'system',
            success: true,
            startTime: 373472.60056,
            endTime: 374850.548128,
            statusCode: 200,
            providerResponseId: 'msg_0148249ws4DisA84opkn9LsD',
          },
        ],
        modelAttemptCount: 1,
        modelAttempts: [
          {
            modelId: 'anthropic:claude-opus-4-20250514',
            canonicalSlug: 'anthropic/claude-opus-4',
            success: true,
            providerAttemptCount: 1,
            providerAttempts: [], //omitted for previty
          },
        ],
        totalProviderAttemptCount: 1,
      },
    },
  };

  const createResult = (
    overrides: Partial<LanguageModelV3GenerateResult> = {},
  ): LanguageModelV3GenerateResult => ({
    content: [{ type: 'text', text: 'The capital of Sweden is Stockholm.' }],
    warnings: [],
    finishReason: { unified: 'stop', raw: 'end_turn' },
    usage: {
      inputTokens: { total: 14, noCache: 14, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    response: {
      id: 'aitxt-jXkwmH5edGJe3YPK2QvqFuHN',
      timestamp: new Date('2026-04-01T07:06:30.155Z'),
    },
    providerMetadata: realMetadata as SharedV3ProviderMetadata,
    ...overrides,
  });

  describe('wrapGenerate', () => {
    it('should extract rich billing data and broadcast it with sub-provider info', async () => {
      const destinationSpy = vi.fn();
      const middleware = createGatewayV3Middleware({
        destinations: [destinationSpy],
      });

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: async () => baseResult,
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      await generateText({ model: wrappedModel, prompt: 'Capital of Sweden?' });

      expect(destinationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: baseResult.response?.id,
          modelId: mockModel.modelId,
          provider: mockModel.provider || 'openrouter',
          usage: {
            subProviderId: realMetadata.gateway?.routing?.finalProvider,
            inputTokens: baseResult.usage?.inputTokens.total,
            outputTokens: baseResult.usage?.outputTokens.total,
            cacheReadTokens: baseResult.usage?.inputTokens.cacheRead ?? 0,
            reasoningTokens: baseResult.usage?.outputTokens.reasoning ?? 0,
            totalTokens:
              (baseResult.usage?.inputTokens.total ?? 0) +
              (baseResult.usage?.outputTokens.total ?? 0),
            rawProviderCost: Number(realMetadata.gateway?.cost),
            rawUpstreamInferenceCost: Number(realMetadata.gateway?.marketCost),
          },
          cost: {
            // Because our mock cost is "0", the middleware resolves to marketCost
            amount: Number(realMetadata.gateway?.marketCost),
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
      const middleware = createGatewayV3Middleware({
        destinations: [destinationSpy],
      });

      const baseResult = createResult({
        providerMetadata: realMetadata as SharedV3ProviderMetadata,
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'gateway', // Updated to 'gateway' to match your log, though any string works
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
              // Optionally assert on these top-level properties too for completeness
              generationId: baseResult.response?.id,
              modelId: mockModel.modelId,
              provider: mockModel.provider,
              usage: {
                subProviderId: realMetadata.gateway?.routing?.finalProvider,
                inputTokens: baseResult.usage?.inputTokens.total,
                outputTokens: baseResult.usage?.outputTokens.total,
                cacheReadTokens: baseResult.usage?.inputTokens.cacheRead ?? 0,
                reasoningTokens: baseResult.usage?.outputTokens.reasoning ?? 0,
                totalTokens:
                  (baseResult.usage?.inputTokens.total ?? 0) +
                  (baseResult.usage?.outputTokens.total ?? 0),
                rawProviderCost: Number(realMetadata.gateway?.cost),
                rawUpstreamInferenceCost: Number(
                  realMetadata.gateway?.marketCost,
                ),
              },
              cost: {
                // Assuming 'cost' is "0" in the mock, it falls back to 'marketCost'
                amount: Number(realMetadata.gateway?.marketCost),
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

    const middleware = createGatewayV3Middleware({
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
    expect(error.message).toContain('Expected');
  });

  it('should hit all fallback branches for full coverage', async () => {
    const destinationSpy = vi.fn();
    const middleware = createGatewayV3Middleware({
      destinations: [destinationSpy],
    });

    const baseResult = createResult({
      response: { id: undefined }, // Hits: crypto.randomUUID fallback
      usage: {
        inputTokens: {
          total: undefined,
          noCache: 0,
          cacheRead: undefined,
          cacheWrite: 0,
        },
        outputTokens: {
          total: undefined,
          text: 0,
          reasoning: undefined,
        },
      },
      providerMetadata: {
        gateway: {
          cost: '0.000004653', // Bypasses the initial cost error check
        },
      } as SharedV3ProviderMetadata,
    });

    const mockModel = new MockLanguageModelV3({
      modelId: 'test-model',
      provider: '', // Hits: model.provider || 'gateway'
      doGenerate: async () => baseResult,
    });

    const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
    await generateText({ model: wrappedModel, prompt: 'Hi' });

    await vi.waitFor(() => expect(destinationSpy).toHaveBeenCalled());

    const event = destinationSpy.mock.calls?.[0]?.[0];

    // Validate that the empty model.provider fell back correctly
    expect(event.provider).toBe('gateway');

    // Validate that missing usage data safely defaulted to 0
    expect(event.usage.inputTokens).toBe(0);
    expect(event.usage.cacheReadTokens).toBe(0);
    expect(event.usage.outputTokens).toBe(0);
    expect(event.usage.reasoningTokens).toBe(0);
    expect(event.usage.totalTokens).toBe(0);

    // Validate that a missing response ID generated a UUID
    expect(event.generationId).toHaveLength(36);
  });
});
