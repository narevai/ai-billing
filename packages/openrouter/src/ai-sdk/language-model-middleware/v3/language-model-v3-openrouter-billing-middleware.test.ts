import { generateText, streamText, wrapLanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { OpenRouterBillingMiddlewareV3 } from './language-model-v3-openrouter-billing-middleware.js';
import {
  MockLanguageModelV3,
  convertArrayToReadableStream,
} from '@ai-billing/testing';
import { AiBillingExtractError } from '@ai-billing/core';

describe('OpenRouterBillingMiddlewareV3 Integration', () => {
  // Common payload that matches the REAL OpenRouter API response
  const realOpenRouterMetadata = {
    openrouter: {
      usage: {
        cost: 0.000004653,
        promptTokens: 7,
        completionTokens: 10,
        totalTokens: 17,
      },
    },
  };

  describe('wrapGenerate (Standard Text)', () => {
    it('should extract billing data and broadcast it to destinations', async () => {
      // 1. Create our spy destination
      const destinationSpy = vi.fn();

      // 2. Initialize middleware with our spy
      const middleware = new OpenRouterBillingMiddlewareV3({
        destinations: [destinationSpy],
      });

      // 3. Setup the mock model with the correct response shape
      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        async doGenerate() {
          return {
            text: 'This is a simulated response.',
            content: [{ type: 'text', text: 'This is a simulated response.' }],
            warnings: [],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: {
                total: 7,
                noCache: 7,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: {
                total: 10,
                text: 10,
                reasoning: 0,
              },
            },
            rawCall: { rawPrompt: null, rawSettings: {} },
            response: { id: 'req-123' },
            providerMetadata: realOpenRouterMetadata,
          };
        },
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      // 4. Trigger generation
      await generateText({
        model: wrappedModel,
        prompt: 'Hello',
      });

      // 5. Assert the destination was called with the correctly mapped data
      expect(destinationSpy).toHaveBeenCalledTimes(1);
      expect(destinationSpy).toHaveBeenCalledWith({
        amount: 0.000004653, // Mapped from cost
        generationId: 'req-123', // Passed through from response.id
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
      });
    });
  });

  describe('wrapStream (Streaming Text)', () => {
    it('should extract billing data upon stream flush and broadcast it', async () => {
      const destinationSpy = vi.fn();

      const middleware = new OpenRouterBillingMiddlewareV3({
        destinations: [destinationSpy],
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
        async doStream() {
          return {
            // We simulate the stream chunks exactly how the AI SDK outputs them
            stream: convertArrayToReadableStream([
              {
                type: 'response-metadata',
                id: 'stream-req-456',
                modelId: 'google/gemini-2.0-flash-001',
                timestamp: new Date(),
              },
              { type: 'text-start', id: 'stream-req-456' },
              { type: 'text-delta', id: 'stream-req-456', delta: 'Hello ' },
              { type: 'text-delta', id: 'stream-req-456', delta: 'World' },
              { type: 'text-end', id: 'stream-req-456' },
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
                  outputTokens: {
                    total: 10,
                    text: 10,
                    reasoning: 0,
                  },
                },
                providerMetadata: realOpenRouterMetadata,
              },
            ]),
          };
        },
      });

      const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

      const result = streamText({
        model: wrappedModel,
        prompt: 'Hello',
      });

      // We MUST consume the entire stream, otherwise the `flush` method
      // in your base middleware's TransformStream will never trigger!
      await result.text;

      expect(destinationSpy).toHaveBeenCalledTimes(1);
      expect(destinationSpy).toHaveBeenCalledWith({
        amount: 0.000004653,
        generationId: 'stream-req-456', // Picked up from the response-metadata chunk
        modelId: 'google/gemini-2.0-flash-001',
        provider: 'openrouter',
      });
    });
  });
});

it('should throw AiBillingExtractError when metadata is missing', async () => {
  const middleware = new OpenRouterBillingMiddlewareV3({
    destinations: [vi.fn()],
  });
  const mockModel = new MockLanguageModelV3({
    async doGenerate() {
      return {
        text: 'This is a simulated response.',
        content: [{ type: 'text', text: 'This is a simulated response.' }],
        warnings: [],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: 7,
            noCache: 7,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 10,
            text: 10,
            reasoning: 0,
          },
        },
        rawCall: { rawPrompt: null, rawSettings: {} },
        response: { id: 'req-123' },
        providerMetadata: {}, // Missing the expected openrouter usage metadata
      };
    },
  });

  const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });

  await expect(
    generateText({
      model: wrappedModel,
      prompt: 'Hello',
    }),
  ).rejects.toThrow(AiBillingExtractError);
});

it('should fallback to crypto.randomUUID() when responseId is missing', async () => {
  const destinationSpy = vi.fn();
  const middleware = new OpenRouterBillingMiddlewareV3({
    destinations: [destinationSpy],
  });

  const mockModel = new MockLanguageModelV3({
    modelId: 'test-model',
    provider: 'openrouter',
    async doGenerate() {
      return {
        text: 'test',
        content: [{ type: 'text', text: 'test' }],
        warnings: [],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          // This is the fix: wrap the numbers in objects
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        rawCall: { rawPrompt: null, rawSettings: {} },
        response: {},
        providerMetadata: {
          openrouter: { usage: { cost: 0.1 } },
        },
      };
    },
  });

  const wrappedModel = wrapLanguageModel({ model: mockModel, middleware });
  await generateText({ model: wrappedModel, prompt: 'Hi' });

  // Check that a UUID was generated (string length of a UUID is 36)
  const lastCall = destinationSpy.mock?.calls?.[0]?.[0];
  expect(lastCall?.generationId).toBeDefined();
  expect(lastCall?.generationId?.length).toBe(36);
});
