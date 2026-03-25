import type { BillingData, BillingDestination } from '../types.js';

/**
 * Abstract base class for all billing destinations.
 * TConfig allows subclasses to define their own specific options.
 */
export abstract class BaseBillingDestination<TConfig = unknown> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  /**
   * The core logic to be implemented by each specific destination.
   */
  protected abstract process(data: BillingData): Promise<void> | void;

  /**
   * The bound method that satisfies the BillingDestination function type.
   * It acts as a wrapper to catch errors so a failing destination
   * doesn't crash the Node process ungracefully.
   */
  public readonly handle: BillingDestination = async data => {
    try {
      await this.process(data);
    } catch (error) {
      // Centralized error handling for all destinations
      console.error(
        `[BillingDestination Error]: Failed to process data for model ${data.modelId}`,
        error,
      );

      // We throw the error so the Promise.allSettled in your middleware
      // can still register it as 'rejected'.
      throw error;
    }
  };
}
