import { describe, expect, it, vi } from 'vitest';
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import { createV3BillingMiddleware } from './language-model-v3-base-billing-middleware.js';
import {
  convertArrayToReadableStream,
  consumeStream,
  MockLanguageModelV3,
  convertReadableStreamToArray,
} from '@ai-billing/testing';

describe('createV3BillingMiddleware', () => {
  const testParams: LanguageModelV3CallOptions = {
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
      inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    response: { id, timestamp: new Date() },
    providerMetadata: metadata,
    warnings: [],
  });

  describe('wrapGenerate', () => {
    it('should broadcast the event to destinations', async () => {
      const destinationSpy = vi.fn();
      const mockEvent = { amount: 0, generationId: 'billing-id-123' };
      const buildEventSpy = vi.fn().mockResolvedValue(mockEvent);

      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [destinationSpy],
      });

      const mockModel = new MockLanguageModelV3({
        modelId: 'test-model',
        provider: 'test-provider',
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      // Verify the event builder received the right base arguments
      expect(buildEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseId: 'resp-1',
          model: mockModel,
          tags: {},
        }),
      );

      // Verify destination was called with the built event
      expect(destinationSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should not broadcast if buildEvent returns null/undefined', async () => {
      const destinationSpy = vi.fn();
      const buildEventSpy = vi.fn().mockResolvedValue(null);

      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [destinationSpy],
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      expect(buildEventSpy).toHaveBeenCalled();
      expect(destinationSpy).not.toHaveBeenCalled();
    });

    it('should properly merge defaultTags and header tags', async () => {
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'event-1' });
      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
        defaultTags: { env: 'production', source: 'api' },
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      const paramsWithHeaders: LanguageModelV3CallOptions = {
        ...testParams,
        headers: {
          'x-ai-billing-tags': JSON.stringify({ source: 'web', user: '123' }),
        },
      };

      await middleware.wrapGenerate!({
        model: mockModel,
        params: paramsWithHeaders,
        doGenerate: () => mockModel.doGenerate(paramsWithHeaders),
        doStream: () => mockModel.doStream(paramsWithHeaders),
      });

      expect(buildEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: { env: 'production', source: 'web', user: '123' },
        }),
      );
    });
  });

  describe('wrapStream', () => {
    it('should not drop or modify any chunks (Parity Check)', async () => {
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn(),
        destinations: [vi.fn()],
      });

      const inputChunks: LanguageModelV3StreamPart[] = [
        { type: 'response-metadata', id: 'req-123', timestamp: new Date() },
        { type: 'text-delta', id: 'block-1', delta: 'Hello' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ];

      const mockModel = new MockLanguageModelV3({
        doStream: { stream: convertArrayToReadableStream(inputChunks) },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      const outputChunks = await convertReadableStreamToArray(stream);
      expect(outputChunks).toEqual(inputChunks);
    });

    it('should prioritize the ID from text-start over response-metadata', async () => {
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'mock-event' });
      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
      });

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            { type: 'response-metadata', id: 'id-from-meta' },
            { type: 'text-start', id: 'id-from-text-start' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
            },
          ]),
        },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      await consumeStream({ stream });

      // Verify that the ID from text-start was the one passed to the event builder
      expect(buildEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseId: 'id-from-text-start',
        }),
      );
    });

    it('should extract providerMetadata from the finish chunk', async () => {
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'mock-event' });
      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
      });

      const mockMetadata: SharedV3ProviderMetadata = {
        someProviderKey: { nestedKey: 'someProviderValue' },
      };

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: {
                  total: 1,
                  noCache: 1,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
              providerMetadata: mockMetadata,
            },
          ]),
        },
      });

      const { stream } = await middleware.wrapStream!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      await consumeStream({ stream });

      expect(buildEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMetadata: mockMetadata,
        }),
      );
    });
  });

  describe('Internal Processing', () => {
    it('should call onError when buildEvent fails', async () => {
      const onError = vi.fn();
      const error = new Error('Build error');
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockRejectedValue(error),
        destinations: [vi.fn()],
        onError,
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should catch and handle invalid JSON in billing tags header', async () => {
      const onError = vi.fn();
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockResolvedValue({}),
        destinations: [vi.fn()],
        onError,
      });

      const paramsWithBadHeaders = {
        ...testParams,
        headers: { 'x-ai-billing-tags': '{ not-json }' },
      };

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: paramsWithBadHeaders,
        doGenerate: () => mockModel.doGenerate(paramsWithBadHeaders),
        doStream: () => mockModel.doStream(paramsWithBadHeaders),
      });

      expect(onError).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    it('should fallback to console.error when no onError is provided', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Silent failure');
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockRejectedValue(error),
        destinations: [vi.fn()],
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ai-billing] Core Error:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });
});
