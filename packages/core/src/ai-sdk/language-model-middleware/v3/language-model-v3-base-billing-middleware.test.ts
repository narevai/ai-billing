import { describe, expect, it, vi } from 'vitest';
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import { LanguageModelV3BillingMiddleware } from './language-model-v3-base-billing-middleware.js';
import {
  convertArrayToReadableStream,
  consumeStream,
  MockLanguageModelV3,
  convertReadableStreamToArray,
} from '@ai-billing/testing';

class TestBillingMiddleware extends LanguageModelV3BillingMiddleware<SharedV3ProviderMetadata> {
  public mockExtract =
    vi.fn<
      (
        metadata: SharedV3ProviderMetadata,
        responseId: string | undefined,
        modelId: string,
        provider: string,
      ) => { cost: number; genId: string } | null
    >();

  protected extractBilling(
    metadata: SharedV3ProviderMetadata,
    responseId: string | undefined,
    modelId: string,
    provider: string,
  ) {
    return this.mockExtract(metadata, responseId, modelId, provider);
  }
}

describe('LanguageModelV3BillingMiddleware (Base)', () => {
  const dummyParams: LanguageModelV3CallOptions = {
    prompt: [],
  };

  // Helper to provide a minimal valid generate result
  const createGenerateResult = (
    id: string,
    metadata?: SharedV3ProviderMetadata,
  ): LanguageModelV3GenerateResult => ({
    content: [],
    finishReason: {
      unified: 'stop',
      raw: 'stop',
    },
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
    response: { id, timestamp: new Date() },
    providerMetadata: metadata,
    warnings: [],
  });

  describe('wrapGenerate', () => {
    it('should broadcast even when cost is 0 (Free Models)', async () => {
      const destinationSpy = vi.fn();
      const middleware = new TestBillingMiddleware({
        destinations: [destinationSpy],
      });

      // Setup middleware behavior
      middleware.mockExtract.mockReturnValue({
        cost: 0,
        genId: 'billing-id-123',
      });

      // Setup mock model using your new utility
      const mockModel = new MockLanguageModelV3({
        modelId: 'test-model',
        provider: 'test-provider',
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: dummyParams,
        doGenerate: () => mockModel.doGenerate(dummyParams),
        doStream: () => mockModel.doStream(dummyParams),
      });

      expect(destinationSpy).toHaveBeenCalledWith({
        amount: 0,
        generationId: 'billing-id-123',
        modelId: 'test-model',
        provider: 'test-provider',
      });
    });

    it('should not broadcast if extractBilling returns null', async () => {
      const destinationSpy = vi.fn();
      const middleware = new TestBillingMiddleware({
        destinations: [destinationSpy],
      });

      middleware.mockExtract.mockReturnValue(null);

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: dummyParams,
        doGenerate: () => mockModel.doGenerate(dummyParams),
        doStream: () => mockModel.doStream(dummyParams),
      });

      expect(destinationSpy).not.toHaveBeenCalled();
    });
  });

  describe('wrapStream', () => {
    it('should not drop or modify any chunks (Parity Check)', async () => {
      const middleware = new TestBillingMiddleware({ destinations: [vi.fn()] });
      const inputChunks: LanguageModelV3StreamPart[] = [
        {
          type: 'response-metadata',
          id: 'req-123',
          timestamp: new Date(),
        },
        {
          type: 'text-delta',
          id: 'block-1',
          delta: 'Hello',
        },
        {
          type: 'finish',
          finishReason: {
            unified: 'stop',
            raw: 'stop',
          },
          usage: {
            inputTokens: {
              total: 1,
              noCache: 1,
              cacheRead: 0,
              cacheWrite: 0,
            },
            outputTokens: {
              total: 1,
              text: 1,
              reasoning: 0,
            },
          },
        },
      ];

      const mockModel = new MockLanguageModelV3({
        doStream: { stream: convertArrayToReadableStream(inputChunks) },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: dummyParams,
        doGenerate: () => mockModel.doGenerate(dummyParams),
        doStream: () => mockModel.doStream(dummyParams),
      });

      const outputChunks = await convertReadableStreamToArray(stream);
      expect(outputChunks).toEqual(inputChunks);
    });

    it('should prioritize the ID from text-start over response-metadata', async () => {
      const destinationSpy = vi.fn();
      const middleware = new TestBillingMiddleware({
        destinations: [destinationSpy],
      });

      middleware.mockExtract.mockImplementation((_meta, id) => ({
        cost: 1.0,
        genId: id ?? 'fallback',
      }));

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            { type: 'response-metadata', id: 'id-from-meta' },
            { type: 'text-start', id: 'id-from-text-start' }, // This should win
            {
              type: 'finish',
              finishReason: {
                unified: 'stop',
                raw: 'stop',
              },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: {
                  total: 1,
                  text: 1,
                  reasoning: 0,
                },
              },
            },
          ]),
        },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: dummyParams,
        doGenerate: () => mockModel.doGenerate(dummyParams),
        doStream: () => mockModel.doStream(dummyParams),
      });

      await consumeStream({ stream });

      expect(middleware.mockExtract).toHaveBeenCalledWith(
        undefined,
        'id-from-text-start',
        'mock-model-id',
        'mock-provider',
      );
    });

    it('should extract providerMetadata from the finish chunk', async () => {
      const middleware = new TestBillingMiddleware({ destinations: [vi.fn()] });
      const mockMetadata: SharedV3ProviderMetadata = {
        someProviderKey: {
          nestedKey: 'someProviderValue',
        },
      };

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            {
              type: 'finish',
              finishReason: {
                unified: 'stop',
                raw: 'stop',
              },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
              providerMetadata: mockMetadata, // This triggers the uncovered line
            },
          ]),
        },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: dummyParams,
        doGenerate: () => mockModel.doGenerate(dummyParams),
        doStream: () => mockModel.doStream(dummyParams),
      });

      await consumeStream({ stream });

      expect(middleware.mockExtract).toHaveBeenCalledWith(
        mockMetadata,
        undefined,
        'mock-model-id',
        'mock-provider',
      );
    });
  });
});
