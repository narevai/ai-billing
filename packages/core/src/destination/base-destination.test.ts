import { describe, it, expect, vi } from 'vitest';
import { createDestination } from './base-destination.js';
import { AiBillingDestinationError } from '../error/index.js';
import type { BillingEvent } from '../types/index.js';
import { JSONObject } from '@ai-sdk/provider';

describe('createDestination', () => {
  const mockDestinationId = 'test-destination';
  const mockBillingEvent = {
    modelId: 'gpt-4o',
    provider: 'openai',
    amount: 1.0,
    tags: { env: 'test' },
  } as unknown as BillingEvent<JSONObject>;

  it('should call the handler with the provided event', async () => {
    const handlerSpy = vi.fn().mockResolvedValue(undefined);
    const destination = createDestination(mockDestinationId, handlerSpy);

    await destination(mockBillingEvent);

    expect(handlerSpy).toHaveBeenCalledWith(mockBillingEvent);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });

  it('should resolve successfully when the handler succeeds', async () => {
    const handler = () => Promise.resolve();
    const destination = createDestination(mockDestinationId, handler);

    await expect(destination(mockBillingEvent)).resolves.toBeUndefined();
  });

  it('should wrap handler errors in AiBillingDestinationError', async () => {
    const originalError = new Error('Network failure');
    const handler = vi.fn().mockRejectedValue(originalError);

    const destination = createDestination(mockDestinationId, handler);

    try {
      await destination(mockBillingEvent);
      // Fail test if it doesn't throw
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(AiBillingDestinationError);
      const destError = error as AiBillingDestinationError;

      // Verify our specific metadata is attached
      expect(destError.destinationId).toBe(mockDestinationId);
      expect(destError.cause).toBe(originalError);
    }
  });

  it('should work with synchronous handlers', async () => {
    const handler = vi.fn(); // returns undefined (sync)
    const destination = createDestination(mockDestinationId, handler);

    await expect(destination(mockBillingEvent)).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalled();
  });
});
