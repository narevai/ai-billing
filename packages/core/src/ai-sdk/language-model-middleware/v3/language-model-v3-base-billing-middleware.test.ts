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

    it('should attach the billing event to providerMetadata', async () => {
      const mockEvent = { generationId: 'gen-event-1', amount: 0.005 };
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockResolvedValue(mockEvent),
        destinations: [],
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      const result = await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      expect((result.providerMetadata as Record<string, unknown>)?.['ai-billing']).toEqual(
        mockEvent,
      );
    });

    it('should not attach ai-billing key when buildEvent returns null', async () => {
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockResolvedValue(null),
        destinations: [],
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      const result = await middleware.wrapGenerate!({
        model: mockModel,
        params: testParams,
        doGenerate: () => mockModel.doGenerate(testParams),
        doStream: () => mockModel.doStream(testParams),
      });

      expect(
        (result.providerMetadata as Record<string, unknown>)?.['ai-billing'],
      ).toBeUndefined();
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

    it('should properly merge defaultTags and providerOptions', async () => {
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'event-1' });
      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
        defaultTags: { env: 'production', source: 'api' },
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      const paramsWithProviderOptions: LanguageModelV3CallOptions = {
        ...testParams,
        providerOptions: {
          'ai-billing-tags': { source: 'web', user: '123' },
        },
      };

      await middleware.wrapGenerate!({
        model: mockModel,
        params: paramsWithProviderOptions,
        doGenerate: () => mockModel.doGenerate(paramsWithProviderOptions),
        doStream: () => mockModel.doStream(paramsWithProviderOptions),
      });

      expect(buildEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: { env: 'production', source: 'web', user: '123' },
        }),
      );
    });

    it('should call waitUntil with a promise representing the background event processing', async () => {
      const waitUntilSpy = vi.fn();
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'event-1' });

      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
        waitUntil: waitUntilSpy,
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

      // Verify waitUntil was called exactly once with a Promise
      expect(waitUntilSpy).toHaveBeenCalledTimes(1);
      expect(waitUntilSpy).toHaveBeenCalledWith(expect.any(Promise));

      // Await the captured promise to ensure the background task finishes cleanly
      const capturedPromise = waitUntilSpy.mock.calls![0]![0];
      await capturedPromise;

      // Verify the background task actually completed
      expect(buildEventSpy).toHaveBeenCalled();
    });
  });

  describe('wrapStream', () => {
    it('should not drop or modify any non-finish chunks (Parity Check)', async () => {
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockResolvedValue(null),
        destinations: [vi.fn()],
      });

      const finishChunk: Extract<LanguageModelV3StreamPart, { type: 'finish' }> = {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      };
      const inputChunks: LanguageModelV3StreamPart[] = [
        { type: 'response-metadata', id: 'req-123', timestamp: new Date() },
        { type: 'text-delta', id: 'block-1', delta: 'Hello' },
        finishChunk,
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

      // Non-finish chunks pass through unmodified
      expect(outputChunks.slice(0, -1)).toEqual(inputChunks.slice(0, -1));

      // Finish chunk is re-emitted with base fields preserved
      const outputFinish = outputChunks.at(-1) as Extract<
        LanguageModelV3StreamPart,
        { type: 'finish' }
      >;
      expect(outputFinish.type).toBe('finish');
      expect(outputFinish.finishReason).toEqual(finishChunk.finishReason);
      expect(outputFinish.usage).toEqual(finishChunk.usage);
      // No event → 'ai-billing' key absent
      expect(
        (outputFinish.providerMetadata as Record<string, unknown>)?.['ai-billing'],
      ).toBeUndefined();
    });

    it('should attach the billing event to the finish chunk providerMetadata', async () => {
      const mockEvent = { generationId: 'stream-event-1', amount: 0.001 };
      const middleware = createV3BillingMiddleware({
        buildEvent: vi.fn().mockResolvedValue(mockEvent),
        destinations: [],
      });

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            { type: 'text-delta', id: 'block-1', delta: 'Hi' },
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

      const outputChunks = await convertReadableStreamToArray(stream);
      const finish = outputChunks.at(-1) as Extract<
        LanguageModelV3StreamPart,
        { type: 'finish' }
      >;
      expect((finish.providerMetadata as Record<string, unknown>)?.['ai-billing']).toEqual(
        mockEvent,
      );
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

    it('should call waitUntil with a promise only after the stream flushes', async () => {
      const waitUntilSpy = vi.fn();
      const buildEventSpy = vi.fn().mockResolvedValue({ id: 'event-stream' });

      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
        waitUntil: waitUntilSpy,
      });

      const mockModel = new MockLanguageModelV3({
        doStream: {
          stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            { type: 'text-delta', id: 'block-1', delta: 'Hello' },
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

      // At this point, the stream is open but not consumed.
      // waitUntil should NOT have been called yet.
      expect(waitUntilSpy).not.toHaveBeenCalled();

      // Consume the stream to trigger the flush() method in the TransformStream
      await consumeStream({ stream });

      // Now waitUntil should have been called with the processEvent promise
      expect(waitUntilSpy).toHaveBeenCalledTimes(1);
      expect(waitUntilSpy).toHaveBeenCalledWith(expect.any(Promise));

      // Clean up by awaiting the captured promise
      const capturedPromise = waitUntilSpy.mock.calls![0]![0];
      await capturedPromise;
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

    it('should catch and handle errors during event processing', async () => {
      const onError = vi.fn();
      // Simulate an error inside buildEvent
      const buildEventSpy = vi
        .fn()
        .mockRejectedValue(new Error('Event build failed'));

      const middleware = createV3BillingMiddleware({
        buildEvent: buildEventSpy,
        destinations: [vi.fn()],
        onError,
      });

      const mockModel = new MockLanguageModelV3({
        doGenerate: createGenerateResult('resp-1'),
      });

      // Valid params, but we expect the middleware to catch the buildEvent rejection
      const params: LanguageModelV3CallOptions = {
        ...testParams,
        providerOptions: {
          'ai-billing-tags': { source: 'web' },
        },
      };

      await middleware.wrapGenerate!({
        model: mockModel,
        params,
        doGenerate: () => mockModel.doGenerate(params),
        doStream: () => mockModel.doStream(params),
      });

      // Verify the error was caught and passed to the onError callback
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock!.calls![0]![0].message).toBe('Event build failed');
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
