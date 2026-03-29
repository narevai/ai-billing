import type { Destination, BillingEvent } from '../types/index.js';
import { AiBillingDestinationError } from '../error/index.js';

export function createDestination<TTags>(
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
