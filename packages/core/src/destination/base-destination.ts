import type { Destination, BillingEvent } from '../types/index.js';
import { AiBillingDestinationError } from '../error/index.js';

export function createDestination<TCustomMeta>(
  destinationId: string,
  handler: (event: BillingEvent<TCustomMeta>) => Promise<void> | void,
): Destination<TCustomMeta> {
  return async (event: BillingEvent<TCustomMeta>) => {
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
