import { describe, it, expect, vi } from 'vitest';
import { BaseBillingDestination } from './base-destination.js';
import { AiBillingDestinationError } from '../error/index.js';
import type { BillingData } from '../types.js';

interface TestConfig {
  apiKey: string;
}

class TestDestination extends BaseBillingDestination<TestConfig> {
  public processMock = vi.fn();

  protected process(data: BillingData): Promise<void> | void {
    return this.processMock(data);
  }

  public getConfig() {
    return this.config;
  }
}

describe('BaseBillingDestination', () => {
  const mockConfig: TestConfig = { apiKey: 'test-key' };
  const mockBillingData = {
    modelId: 'gpt-4o',
  } as BillingData;

  it('should assign config in the constructor', () => {
    const destination = new TestDestination(mockConfig);
    expect(destination.getConfig()).toEqual(mockConfig);
  });

  it('should process data successfully without throwing', async () => {
    const destination = new TestDestination(mockConfig);

    destination.processMock.mockResolvedValueOnce(undefined);

    await expect(destination.handle(mockBillingData)).resolves.toBeUndefined();

    expect(destination.processMock).toHaveBeenCalledWith(mockBillingData);
    expect(destination.processMock).toHaveBeenCalledTimes(1);
  });

  it('should catch errors and throw an AiBillingDestinationError with the original cause', async () => {
    const destination = new TestDestination(mockConfig);
    const originalError = new Error('Simulated network timeout');

    destination.processMock.mockRejectedValueOnce(originalError);
    const handlePromise = destination.handle(mockBillingData);

    await expect(handlePromise).rejects.toThrow(AiBillingDestinationError);

    await expect(handlePromise).rejects.toSatisfy(
      (error: AiBillingDestinationError) => {
        expect(AiBillingDestinationError.isInstance(error)).toBe(true);

        expect(error.modelId).toBe(mockBillingData.modelId);
        expect(error.cause).toBe(originalError);

        return true;
      },
    );
  });
});
