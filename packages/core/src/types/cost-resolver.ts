import type { UsageEvent, Cost } from './event.js';

/**
 * A service that resolves the cost of a billing event based on usage.
 */
export type CostResolver = {
  /**
   * Unique identifier for the resolver implementation (e.g., 'static-json', 'api-lookup').
   */
  readonly resolverId: string;

  /**
   * Calculates the cost based on the normalized usage and model metadata.
   * Returns a Cost object or null if the resolver cannot determine the price.
   */
  resolve(event: UsageEvent): Promise<Cost | null> | Cost | null;
};
