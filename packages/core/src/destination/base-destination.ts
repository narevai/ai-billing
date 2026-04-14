import type { Destination, BillingEvent, DefaultTags } from '../types/index.js';
import { AiBillingDestinationError } from '../error/index.js';

/**
 * Creates a destination wrapper that normalizes destination handler errors.
 *
 * @param destinationId Unique identifier for the destination.
 * @param handler Destination implementation invoked for each billing event.
 * @returns A destination function that wraps thrown errors as AiBillingDestinationError.
 */
export function createDestination<TTags extends DefaultTags = DefaultTags>(
  destinationId: string,
  handler: (event: BillingEvent<TTags>) => Promise<void> | void,
): Destination<TTags> {
  return async (event: BillingEvent<TTags>) => {
    try {
      await handler(event);
    } catch (error) {
      throw new AiBillingDestinationError({
        destinationId,
        cause: error,
      });
    }
  };
}
